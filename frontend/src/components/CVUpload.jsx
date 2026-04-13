import React, { useState } from 'react';
import axios from 'axios';
import { UploadCloud } from 'lucide-react';

const CVUpload = () => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleUpload = async (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        const formData = new FormData();
        formData.append('file', selectedFile);

        setLoading(true);
        try {
            await axios.post('http://127.0.0.1:8000/upload-cv', formData);
            alert("CV Uploaded and Analyzed!");
        } catch (error) {
            alert("Error uploading file");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative border-2 border-dashed border-blue-200 rounded-xl p-8 transition hover:bg-blue-50 group">
            <input 
                type="file" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleUpload}
                accept=".pdf"
                disabled={loading}
            />
            <div className="text-center">
                <UploadCloud className="mx-auto text-blue-400 mb-4 group-hover:scale-110 transition" size={48} />
                <p className="text-sm font-medium text-gray-700">
                    {loading ? "Analyzing Document..." : "Drop your CV here or click to browse"}
                </p>
                <p className="text-xs text-gray-400 mt-2">Support only PDF format</p>
            </div>
        </div>
    );
};

export default CVUpload;