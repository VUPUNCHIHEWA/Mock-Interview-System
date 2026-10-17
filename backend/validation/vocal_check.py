"""
vocal_check.py

Validation of the vocal factors with ONE set of recordings:
  * Speech Rate  (SPEECH_RATE_SCORING.md, section 8)
  * Long Pauses  (LONG_PAUSES_SCORING.md, section 6)
  * Pitch Variation (PITCH_VARIATION_SCORING.md, section 6)

For each factor two checks are made:
  (a) MEASUREMENT - does the app measure it correctly? The app's value is
      compared with the researcher's own measurement (Audacity for words,
      time and pauses; Praat for pitch).
  (b) CONFIDENCE - does the factor score agree with how confident the
      speaker sounds to people? Raters' 1-5 ratings are compared with the
      score (Spearman correlation).

Usage (from the backend/ folder, with backend/.env set up as for the app):

  STEP 1  python -m validation.vocal_check run PATH/TO/AUDIO_FOLDER
          -> vocal_system.csv  (app results - do NOT open it before your
                                own measuring is finished)
          -> vocal_manual.csv  (sheet for your measurements and ratings)
          -> vocal_wav/        (a .wav copy of every recording, to open in Praat)

  STEP 2  fill vocal_manual.csv (leave a cell empty if not measured):
            manual_words              words you hear (count by ear; not um/uh)
            manual_answer_seconds     first sound -> last sound (Audacity)
            manual_long_pause_seconds total of silences of 3 s or more (0 if none)
            manual_long_pause_count   number of silences of 3 s or more (0 if none)
            praat_mean_hz             Praat: Query > Get mean (Hertz)
            praat_sd_hz               Praat: Query > Get standard deviation (Hertz)
            gender                    M or F (to check the male/female difference, L12)
            rater1, rater2, rater3    "How confident does the speaker
                                      sound?" 1 (not at all) - 5 (very)

  STEP 3  python -m validation.vocal_check evaluate
          -> vocal_report.md

Acceptance rules (researcher choices, ASSUMPTIONS B31, B34):
  Speech Rate (a): mean absolute WPM error <= 10 % over at least 15 recordings
  Long Pauses (a): mean absolute difference in long-pause share <= 5
                   percentage points over at least 15 recordings
  Pitch (a):       mean F0 within 5 % of Praat AND Pearson r (app vs Praat
                   pitch variation) >= 0.80, over at least 15 recordings
  All (b):         Spearman rho (score vs mean rating) > 0 and p < .05
"""

import argparse
import csv
import os
import sys
import tempfile
import time
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

ACCEPT_WPM_PCT_ERROR = 10.0
ACCEPT_PAUSE_SHARE_POINTS = 5.0
ACCEPT_F0_PCT_ERROR = 5.0
ACCEPT_PVQ_R = 0.80
MIN_CLIPS = 15
AUDIO_EXTS = {".webm", ".wav", ".mp3", ".m4a", ".ogg", ".mp4", ".flac", ".aac"}
RATER_COLS = ["rater1", "rater2", "rater3"]

SYSTEM_COLUMNS = ["clip", "engine", "answer_seconds",
                  # Speech Rate
                  "words", "speaking_seconds", "wpm", "sr_score", "sr_label",
                  # Long Pauses
                  "long_pause_count", "long_pause_seconds", "long_pause_share_pct", "lp_score",
                  # Pitch Variation (pvq = the 10-s-piece value the score uses;
                  # mean / sd / pvq_whole = whole answer, to compare with Praat)
                  "pitch_pvq", "pitch_score", "pitch_mean_hz", "pitch_sd_hz", "pitch_pvq_whole",
                  "transcript"]
MANUAL_COLUMNS = ["clip", "manual_words", "manual_answer_seconds",
                  "manual_long_pause_seconds", "manual_long_pause_count",
                  "praat_mean_hz", "praat_sd_hz", "gender",
                  "rater1", "rater2", "rater3", "notes"]


def _read(path):
    if not Path(path).exists():
        return []
    with open(path, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def _write(path, rows, columns):
    with open(path, "w", newline="", encoding="utf-8-sig") as f:  # -sig: opens cleanly in Excel
        w = csv.DictWriter(f, fieldnames=columns, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({c: r.get(c, "") for c in columns})


def _num(v):
    try:
        return float(str(v).strip())
    except (TypeError, ValueError):
        return None


def _whole_answer_pitch(wav):
    """Mean and SD (Hz) of the voice pitch over the WHOLE answer, using the
    same frames as the app (voice_analysis._pitch_metrics: pYIN 60-500 Hz,
    inside sound parts, voicing probability >= 0.5). Praat gives the same two
    numbers for the whole file, so they can be compared directly."""
    import librosa
    import numpy as np
    from app.services import voice_analysis as va
    y, sr = librosa.load(wav, sr=None)
    intervals = librosa.effects.split(y, top_db=va.SILENCE_TOP_DB)
    if len(intervals) == 0:
        return None, None
    start, end = intervals[0][0], intervals[-1][1]
    f0, voiced, prob = librosa.pyin(y[start:end], fmin=va.PITCH_FMIN_HZ,
                                    fmax=va.PITCH_FMAX_HZ, sr=sr)
    frames = start + np.arange(len(f0)) * va.PYIN_HOP
    in_sound = np.zeros(len(f0), dtype=bool)
    for a, b in intervals:
        in_sound |= (frames >= a) & (frames < b)
    sel = voiced & in_sound & (prob >= 0.5) & ~np.isnan(f0)
    v = f0[sel]
    if len(v) < 2:
        return None, None
    return float(np.mean(v)), float(np.std(v))


# ---------------------------------------------------------------------------
# STEP 1 - app measurements
# ---------------------------------------------------------------------------
def run(folder, out, manual, gap, wav_dir="vocal_wav"):
    from dotenv import load_dotenv
    load_dotenv(BACKEND_DIR / ".env")  # before ai_provider reads the API keys
    from pydub import AudioSegment
    from app.services import ai_provider
    from app.services.voice_analysis import (analyze_voice, speech_rate_score,
                                             speech_rate_label, long_pause_score,
                                             pitch_score)

    folder = Path(folder)
    if not folder.is_dir():
        sys.exit(f"Folder not found: {folder}")
    clips = sorted(p for p in folder.rglob("*") if p.suffix.lower() in AUDIO_EXTS)
    if not clips:
        sys.exit(f"No audio files found in {folder}")

    rows = _read(out)
    done = {r["clip"] for r in rows}
    Path(wav_dir).mkdir(exist_ok=True)
    for i, clip_path in enumerate(clips, 1):
        clip = str(clip_path.relative_to(folder))
        if clip in done:
            print(f"[{i}/{len(clips)}] {clip}: already done - skipped")
            continue
        print(f"[{i}/{len(clips)}] {clip}")
        with tempfile.TemporaryDirectory() as tmp:
            wav = os.path.join(tmp, "answer.wav")
            try:
                audio = AudioSegment.from_file(clip_path)
                audio.export(wav, format="wav")
            except Exception as e:
                print(f"   could not read the file ({e}) - skipped")
                continue
            try:
                text, engine = ai_provider.transcribe(audio, wav)  # same pipeline as the app
            except Exception as e:
                text, engine = "", f"failed: {e}"
            m = analyze_voice(text, wav)                           # same measures as the app
            try:
                f0_mean, f0_sd = _whole_answer_pitch(wav)
            except Exception as e:
                print(f"   whole-answer pitch failed ({e})")
                f0_mean, f0_sd = None, None
            # .wav copy for Praat (Praat cannot open .webm)
            praat_name = Path(clip).with_suffix(".wav").as_posix().replace("/", "__")
            audio.export(str(Path(wav_dir) / praat_name), format="wav")
        ans = m.get("speech_seconds") or 0.0
        lp = m.get("long_pause_seconds") or 0.0
        speak = max(0.0, ans - lp)
        wpm = m["word_count"] / (speak / 60.0) if speak > 0 and text.strip() else None
        share = lp / ans if ans > 0 else None
        row = {"clip": clip, "engine": engine, "answer_seconds": ans or "",
               "words": m["word_count"], "speaking_seconds": round(speak, 2),
               "wpm": round(wpm, 1) if wpm else "",
               "sr_score": speech_rate_score(wpm) if wpm else "",
               "sr_label": speech_rate_label(wpm) or "",
               "long_pause_count": m.get("long_pause_count", 0),
               "long_pause_seconds": lp,
               "long_pause_share_pct": round(100 * share, 1) if share is not None else "",
               "lp_score": long_pause_score(share) if share is not None else "",
               "pitch_pvq": m.get("pitch_pvq") if m.get("pitch_pvq") is not None else "",
               "pitch_score": pitch_score(m.get("pitch_pvq")) if m.get("pitch_pvq") is not None else "",
               "pitch_mean_hz": round(f0_mean, 1) if f0_mean else "",
               "pitch_sd_hz": round(f0_sd, 1) if f0_sd else "",
               "pitch_pvq_whole": round(f0_sd / f0_mean, 4) if f0_mean else "",
               "transcript": text}
        rows.append(row)
        _write(out, rows, SYSTEM_COLUMNS)  # save after every clip
        print(f"   {row['words']} words, {row['speaking_seconds']} s speaking -> {row['wpm']} WPM; "
              f"long pauses: {row['long_pause_count']} ({lp} s); pitch PVQ {row['pitch_pvq']}")
        time.sleep(gap)

    sheet = {r["clip"]: r for r in _read(manual)}  # keep anything already filled in
    for r in rows:
        sheet.setdefault(r["clip"], {"clip": r["clip"]})
    _write(manual, sorted(sheet.values(), key=lambda r: r["clip"]), MANUAL_COLUMNS)
    print(f"\nApp results : {Path(out).resolve()}  (do not open before your own measuring)")
    print(f"Your sheet  : {Path(manual).resolve()}")
    print(f"For Praat   : {Path(wav_dir).resolve()}  (open these .wav files in Praat)")
    print("Next: fill your sheet, then run  python -m validation.vocal_check evaluate")


# ---------------------------------------------------------------------------
# STEP 3 - comparison
# ---------------------------------------------------------------------------
def _spearman(a, b):
    try:
        from scipy.stats import spearmanr
    except Exception:
        return None, None
    if len(a) < 3 or len(set(a)) < 2 or len(set(b)) < 2:
        return None, None
    rho, p = spearmanr(a, b)
    return float(rho), float(p)


def _pearson(a, b):
    n = len(a)
    if n < 3:
        return None
    ma, mb = sum(a) / n, sum(b) / n
    sa = sum((x - ma) ** 2 for x in a) ** 0.5
    sb = sum((y - mb) ** 2 for y in b) ** 0.5
    if not sa or not sb:
        return None
    return sum((x - ma) * (y - mb) for x, y in zip(a, b)) / (sa * sb)


def _f(x, d=2):
    return "—" if x is None else f"{x:.{d}f}"


def _confidence_check(name, score_col, system, manual):
    """(b) Spearman between a factor score and the mean rater rating,
    plus how many recordings sit at the top (100) or bottom of the scale."""
    scores, means = [], []
    per_rater = {c: [] for c in RATER_COLS}
    for clip, m in manual.items():
        s = system.get(clip)
        sc = _num(s.get(score_col)) if s else None
        ratings = [_num(m.get(c)) for c in RATER_COLS]
        given = [x for x in ratings if x is not None]
        if sc is None or not given:
            continue
        scores.append(sc)
        means.append(sum(given) / len(given))
        for c, x in zip(RATER_COLS, ratings):
            per_rater[c].append(x)
    lines = [f"### (b) Does the {name} score agree with how confident the speaker sounds?", ""]
    if len(scores) < 3:
        return lines + ["Fewer than 3 recordings have both a score and a rating.", ""]
    rho, p = _spearman(scores, means)
    pair_rhos = []
    for i in range(3):
        for j in range(i + 1, 3):
            a, b = per_rater[RATER_COLS[i]], per_rater[RATER_COLS[j]]
            both = [(x, y) for x, y in zip(a, b) if x is not None and y is not None]
            if len(both) >= 3:
                rr, _ = _spearman([x for x, _ in both], [y for _, y in both])
                if rr is not None:
                    pair_rhos.append(rr)
    agree = sum(pair_rhos) / len(pair_rhos) if pair_rhos else None
    top = sum(1 for x in scores if x >= 100)
    low = min(scores)
    bottom = sum(1 for x in scores if x <= low)
    lines += ["| Measure | Value |", "|---|---|",
              f"| Recordings rated | {len(scores)} |",
              f"| **Spearman ρ (score vs mean rating)** | **{_f(rho)}** (p = {_f(p, 3)}) |",
              f"| Agreement between raters (mean pairwise ρ) | {_f(agree)} |",
              f"| Recordings with score 100 (ceiling) | {top} of {len(scores)} ({100 * top / len(scores):.0f} %) |",
              f"| Recordings at the lowest score ({low:g}) | {bottom} of {len(scores)} ({100 * bottom / len(scores):.0f} %) |", ""]
    if rho is None:
        verdict = ("CANNOT TEST - the scores (or ratings) are all the same, so no correlation can be "
                   "computed. Report this as a ceiling/floor effect (see the two rows above).")
    elif rho > 0 and p is not None and p < 0.05:
        verdict = f"PASS - higher {name} scores go with higher confidence ratings."
    else:
        verdict = ("NOT SHOWN - no significant positive link in this sample. Report it honestly; "
                   "check the sample size, rater agreement and the ceiling/floor rows above.")
    return lines + [f"**Verdict (b):** {verdict}", ""]


def evaluate(system_path, manual_path, out_path):
    from app.services.voice_analysis import speech_rate_score, long_pause_score

    system = {r["clip"]: r for r in _read(system_path)}
    manual = {r["clip"]: r for r in _read(manual_path)}
    if not system or not manual:
        sys.exit("Run STEP 1 first and fill in the manual sheet.")

    lines = ["# Vocal factors check - results", ""]

    # ---------------- Speech Rate ----------------
    lines += ["## 1. Speech Rate", "", "### (a) Does the app measure words per minute correctly?", ""]
    pairs = []
    for clip, m in manual.items():
        s = system.get(clip)
        words, ans = _num(m.get("manual_words")), _num(m.get("manual_answer_seconds"))
        if s is None or words is None or not ans or _num(s.get("wpm")) is None:
            continue
        speak = ans - (_num(m.get("manual_long_pause_seconds")) or 0.0)
        if speak <= 0:
            continue
        pairs.append({"clip": clip, "sys": _num(s["wpm"]), "man": words / (speak / 60.0),
                      "sys_words": _num(s["words"]), "man_words": words,
                      "sys_speak": _num(s["speaking_seconds"]), "man_speak": speak})
    if pairs:
        mean_pct = sum(abs(p["sys"] - p["man"]) / p["man"] * 100 for p in pairs) / len(pairs)
        mae = sum(abs(p["sys"] - p["man"]) for p in pairs) / len(pairs)
        bias = sum(p["sys"] - p["man"] for p in pairs) / len(pairs)
        word_pct = sum(abs(p["sys_words"] - p["man_words"]) / p["man_words"] * 100
                       for p in pairs if p["man_words"]) / len(pairs)
        time_mae = sum(abs(p["sys_speak"] - p["man_speak"]) for p in pairs) / len(pairs)
        r = _pearson([p["sys"] for p in pairs], [p["man"] for p in pairs])
        score_err = sum(abs(speech_rate_score(p["sys"]) - speech_rate_score(p["man"]))
                        for p in pairs) / len(pairs)
        slow = sum(1 for p in pairs if p["man"] < 113)
        lines += ["| Measure | Value |", "|---|---|",
                  f"| Recordings compared | {len(pairs)} |",
                  f"| **Mean absolute WPM error** | **{mean_pct:.1f} %** ({mae:.1f} WPM) |",
                  f"| Bias (app − you) | {bias:+.1f} WPM |",
                  f"| Mean word-count error | {word_pct:.1f} % |",
                  f"| Mean speaking-time error | {time_mae:.2f} s |",
                  f"| Pearson r (app vs you) | {_f(r)} |",
                  f"| Mean score difference this causes | {score_err:.1f} points |",
                  f"| Answers slower than 113 WPM (floor, L44) | {slow} of {len(pairs)} ({100 * slow / len(pairs):.0f} %) |", ""]
        if len(pairs) < MIN_CLIPS:
            verdict = f"NOT ENOUGH DATA - {len(pairs)} recordings (need {MIN_CLIPS}+)."
        elif mean_pct <= ACCEPT_WPM_PCT_ERROR:
            verdict = "PASS - the app measures speech rate accurately enough."
        else:
            verdict = ("NEEDS FIX - the WPM error is too large. Look at the recordings with the "
                       "biggest differences below (wrong words? wrong start/end of the answer?).")
        lines += [f"**Verdict (a):** {verdict}", "",
                  "| Clip | App WPM | Your WPM | Difference | App words | Your words |",
                  "|---|---|---|---|---|---|"]
        for p in sorted(pairs, key=lambda p: abs(p["sys"] - p["man"]), reverse=True):
            lines.append(f"| {p['clip']} | {p['sys']:.0f} | {p['man']:.0f} | {p['sys'] - p['man']:+.0f} | "
                         f"{p['sys_words']:.0f} | {p['man_words']:.0f} |")
        lines.append("")
    else:
        lines += ["No recordings have manual_words and manual_answer_seconds yet.", ""]
    lines += _confidence_check("Speech Rate", "sr_score", system, manual)

    # ---------------- Long Pauses ----------------
    lines += ["## 2. Long Pauses", "", "### (a) Does the app measure long pauses correctly?", ""]
    lp_pairs = []
    for clip, m in manual.items():
        s = system.get(clip)
        ans, lp = _num(m.get("manual_answer_seconds")), _num(m.get("manual_long_pause_seconds"))
        if s is None or not ans or lp is None or _num(s.get("long_pause_share_pct")) is None:
            continue
        lp_pairs.append({"clip": clip, "sys_share": _num(s["long_pause_share_pct"]),
                         "man_share": 100 * lp / ans,
                         "sys_n": _num(s.get("long_pause_count")),
                         "man_n": _num(m.get("manual_long_pause_count")),
                         "sys_s": _num(s.get("long_pause_seconds")), "man_s": lp})
    if lp_pairs:
        share_mae = sum(abs(p["sys_share"] - p["man_share"]) for p in lp_pairs) / len(lp_pairs)
        sec_mae = sum(abs((p["sys_s"] or 0) - p["man_s"]) for p in lp_pairs) / len(lp_pairs)
        counted = [p for p in lp_pairs if p["man_n"] is not None and p["sys_n"] is not None]
        same_n = sum(1 for p in counted if p["sys_n"] == p["man_n"])
        score_err = sum(abs(long_pause_score(p["sys_share"] / 100) - long_pause_score(p["man_share"] / 100))
                        for p in lp_pairs) / len(lp_pairs)
        with_pause = sum(1 for p in lp_pairs if p["man_s"] > 0)
        lines += ["| Measure | Value |", "|---|---|",
                  f"| Recordings compared | {len(lp_pairs)} |",
                  f"| **Mean difference in long-pause share** | **{share_mae:.1f} percentage points** |",
                  f"| Mean difference in long-pause time | {sec_mae:.2f} s |",
                  f"| Same number of long pauses | {same_n} of {len(counted)} recordings |" if counted
                  else "| Same number of long pauses | — (manual_long_pause_count not filled) |",
                  f"| Mean score difference this causes | {score_err:.1f} points |",
                  f"| Recordings that really had a long pause (your count) | {with_pause} of {len(lp_pairs)} |", ""]
        if len(lp_pairs) < MIN_CLIPS:
            verdict = f"NOT ENOUGH DATA - {len(lp_pairs)} recordings (need {MIN_CLIPS}+)."
        elif share_mae <= ACCEPT_PAUSE_SHARE_POINTS:
            verdict = "PASS - the app measures long pauses accurately enough."
        else:
            verdict = ("NEEDS FIX - the long-pause share differs too much. Check the recordings below "
                       "(background noise? very quiet speech?) with validation.audio_level_check.")
        lines += [f"**Verdict (a):** {verdict}", "",
                  "| Clip | App share % | Your share % | App pauses | Your pauses |",
                  "|---|---|---|---|---|"]
        for p in sorted(lp_pairs, key=lambda p: abs(p["sys_share"] - p["man_share"]), reverse=True):
            lines.append(f"| {p['clip']} | {p['sys_share']:.1f} | {p['man_share']:.1f} | "
                         f"{_f(p['sys_n'], 0)} | {_f(p['man_n'], 0)} |")
        lines.append("")
    else:
        lines += ["No recordings have manual_answer_seconds and manual_long_pause_seconds yet.", ""]
    lines += _confidence_check("Long Pauses", "lp_score", system, manual)

    # ---------------- Pitch Variation ----------------
    lines += ["## 3. Pitch Variation", "", "### (a) Does the app measure pitch correctly? (compared with Praat)", ""]
    pp = []
    for clip, m in manual.items():
        s = system.get(clip)
        pm, psd = _num(m.get("praat_mean_hz")), _num(m.get("praat_sd_hz"))
        if s is None or not pm or psd is None or not _num(s.get("pitch_mean_hz")):
            continue
        pp.append({"clip": clip, "app_mean": _num(s["pitch_mean_hz"]), "praat_mean": pm,
                   "app_pvq": _num(s["pitch_pvq_whole"]), "praat_pvq": psd / pm})
    if pp:
        f0_err = sum(abs(p["app_mean"] - p["praat_mean"]) / p["praat_mean"] * 100 for p in pp) / len(pp)
        pvq_mae = sum(abs(p["app_pvq"] - p["praat_pvq"]) for p in pp) / len(pp)
        r = _pearson([p["app_pvq"] for p in pp], [p["praat_pvq"] for p in pp])
        lines += ["| Measure | Value |", "|---|---|",
                  f"| Recordings compared | {len(pp)} |",
                  f"| **Mean F0 error (app vs Praat)** | **{f0_err:.1f} %** |",
                  f"| **Pearson r, pitch variation (app vs Praat)** | **{_f(r)}** |",
                  f"| Mean difference in pitch variation (SD ÷ mean) | {pvq_mae:.3f} |", ""]
        if len(pp) < MIN_CLIPS:
            verdict = f"NOT ENOUGH DATA - {len(pp)} recordings (need {MIN_CLIPS}+)."
        elif f0_err <= ACCEPT_F0_PCT_ERROR and r is not None and r >= ACCEPT_PVQ_R:
            verdict = "PASS - the app's pitch measurement agrees with Praat."
        else:
            verdict = ("NEEDS FIX - the app's pitch differs from Praat. Look at the recordings below "
                       "(octave jumps? background noise?) and check that Praat used 60-500 Hz.")
        lines += [f"**Verdict (a):** {verdict}", "",
                  "| Clip | App mean Hz | Praat mean Hz | App variation | Praat variation |",
                  "|---|---|---|---|---|"]
        for p in sorted(pp, key=lambda p: abs(p["app_pvq"] - p["praat_pvq"]), reverse=True):
            lines.append(f"| {p['clip']} | {p['app_mean']:.0f} | {p['praat_mean']:.0f} | "
                         f"{p['app_pvq']:.3f} | {p['praat_pvq']:.3f} |")
        lines.append("")
    else:
        lines += ["No recordings have praat_mean_hz and praat_sd_hz yet.", ""]
    lines += _confidence_check("Pitch Variation", "pitch_score", system, manual)

    # male / female difference (Hincks 2005 found higher PVQ for men, L12)
    by_g = {}
    for clip, m in manual.items():
        g = (m.get("gender") or "").strip().upper()[:1]
        s = system.get(clip)
        pvq, sc = (_num(s.get("pitch_pvq")), _num(s.get("pitch_score"))) if s else (None, None)
        if g in ("M", "F") and pvq is not None:
            by_g.setdefault(g, []).append((pvq, sc))
    if by_g:
        lines += ["### Male / female check (L12)", "", "| Gender | Recordings | Mean PVQ | Mean Pitch score |", "|---|---|---|---|"]
        for g in sorted(by_g):
            vals = by_g[g]
            lines.append(f"| {g} | {len(vals)} | {sum(v for v, _ in vals) / len(vals):.3f} | "
                         f"{sum(x for _, x in vals if x is not None) / len(vals):.1f} |")
        lines += ["", "A large gap between M and F means the 0.06 / 0.15 anchors may favour one group; report it.", ""]

    report = "\n".join(lines) + "\n"
    Path(out_path).write_text(report, encoding="utf-8")
    print(report)
    print(f"Report saved to {Path(out_path).resolve()}")


def main():
    ap = argparse.ArgumentParser(description="Vocal factors validation (measurement + confidence).")
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run", help="STEP 1: measure the recordings with the app")
    r.add_argument("folder")
    r.add_argument("--out", default="vocal_system.csv")
    r.add_argument("--manual", default="vocal_manual.csv")
    r.add_argument("--gap", type=float, default=3.0, help="seconds between clips (Groq rate limit)")
    r.add_argument("--wav-dir", default="vocal_wav", help="folder for .wav copies to open in Praat")
    e = sub.add_parser("evaluate", help="STEP 3: compare with your measurements and ratings")
    e.add_argument("--system", default="vocal_system.csv")
    e.add_argument("--manual", default="vocal_manual.csv")
    e.add_argument("--out", default="vocal_report.md")
    a = ap.parse_args()
    if a.cmd == "run":
        run(a.folder, a.out, a.manual, a.gap, a.wav_dir)
    else:
        evaluate(a.system, a.manual, a.out)


if __name__ == "__main__":
    main()
