import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Calendar, Target, Award, PlayCircle, Loader2, ArrowRight } from 'lucide-react';

const History = () => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchingDetails, setFetchingDetails] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchHistory = async () => {
            const userId = localStorage.getItem("userId");
            if (!userId) {
                setLoading(false);
                return;
            }
            try {
                const response = await axios.get(`http://localhost:8000/api/interview-history/${userId}`);
                if (response.data.success) {
                    setHistory(response.data.history);
                }
            } catch (err) {
                console.error("Error fetching history:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, []);

    const handleViewDetails = async (sessionId) => {
        setFetchingDetails(sessionId);
        try {
            const response = await axios.get(`http://localhost:8000/api/interview-session/${sessionId}`);
            if (response.data.success) {
                navigate('/interview-results', { state: { results: response.data.results } });
            }
        } catch (err) {
            console.error("Error fetching session details:", err);
            alert("Could not load interview details.");
        } finally {
            setFetchingDetails(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-blue-500" size={48} />
            </div>
        );
    }

    return (
        <div className="p-6 md:p-10 animate-in fade-in duration-500 max-w-6xl mx-auto">
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-3 mb-8">
                <Calendar className="text-blue-500" size={32} />
                Interview History
            </h1>

            {history.length === 0 ? (
                <div className="bg-slate-50 border border-slate-100 p-10 rounded-[2rem] text-center shadow-sm">
                    <p className="text-slate-500 font-medium">You haven't completed any mock interviews yet.</p>
                    <button 
                        onClick={() => navigate('/InterviewSetup')}
                        className="mt-6 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold transition-colors inline-flex items-center gap-2"
                    >
                        Start Your First Interview <PlayCircle size={18} />
                    </button>
                </div>
            ) : (
                <div className="grid gap-4">
                    {history.map((session, idx) => (
                        <div key={idx} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-white ${session.overallScore >= 80 ? 'bg-green-500' : session.overallScore >= 60 ? 'bg-orange-500' : 'bg-red-500'}`}>
                                    {session.overallScore}
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800">{session.role}</h3>
                                    <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">
                                        {new Date(session.createdAt).toLocaleDateString()} • {session.interviewMode} Mode • {session.difficulty}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-4 w-full md:w-auto">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${session.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                    {session.status}
                                </span>
                                
                                {session.status === 'Completed' && (
                                    <button 
                                        onClick={() => handleViewDetails(session.sessionId)}
                                        disabled={fetchingDetails === session.sessionId}
                                        className="ml-auto md:ml-0 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                                    >
                                        {fetchingDetails === session.sessionId ? <Loader2 size={14} className="animate-spin" /> : "View Details"}
                                        <ArrowRight size={14} />
                                    </button>
                                )}
                            </div>
                            
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default History;