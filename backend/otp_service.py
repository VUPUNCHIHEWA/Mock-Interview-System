import smtplib
from email.mime.text import MIMEText

def send_otp_email(receiver_email, otp):

    sender_email = "your_email@gmail.com"
    password = "your_app_password"

    msg = MIMEText(f"Your OTP code is: {otp}")
    msg["Subject"] = "Mock Interview System OTP"
    msg["From"] = sender_email
    msg["To"] = receiver_email

    server = smtplib.SMTP_SSL("smtp.gmail.com", 465)
    server.login(sender_email, password)
    server.sendmail(sender_email, receiver_email, msg.as_string())
    server.quit()