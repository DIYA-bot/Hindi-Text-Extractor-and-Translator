import React, { useState, useEffect } from 'react';

// Main App component
const App = () => {
    // State variables to manage the application's data and UI
    const [selectedImage, setSelectedImage] = useState(null); // Stores the uploaded image file
    const [imagePreviewUrl, setImagePreviewUrl] = useState(null); // Stores the Data URL for image preview
    const [extractedHindiText, setExtractedHindiText] = useState(''); // Stores the text extracted from the image
    const [translatedText, setTranslatedText] = useState(''); // Stores the translated text
    const [targetLanguage, setTargetLanguage] = useState('en'); // Stores the user's selected target language (default: English)
    const [isLoading, setIsLoading] = useState(false); // Indicates if an operation is in progress
    const [errorMessage, setErrorMessage] = useState(''); // Stores any error messages
    const [copiedExtracted, setCopiedExtracted] = useState(false); // State for 'Copied!' feedback for extracted text
    const [copiedTranslated, setCopiedTranslated] = useState(false); // State for 'Copied!' feedback for translated text

    // Firebase configuration and authentication variables (provided by the environment)
    // These are placeholders and will be populated by the Canvas environment at runtime.
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

    // Effect to handle image file selection and create a preview URL
    useEffect(() => {
        if (selectedImage) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreviewUrl(reader.result); // Set the Data URL for image preview
            };
            reader.readAsDataURL(selectedImage); // Read the image file as a Data URL
        } else {
            setImagePreviewUrl(null); // Clear preview if no image is selected
        }
    }, [selectedImage]);

    // Function to convert a Data URL (base64) to a plain base64 string
    // This is necessary because the Gemini API expects a plain base64 string without the "data:image/..." prefix
    const dataURLtoBase64 = (dataurl) => {
        return dataurl.split(',')[1];
    };

    // Function to handle copying text to clipboard
    const handleCopyToClipboard = (text, setCopiedState) => {
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy'); // Use execCommand for broader compatibility in iframes
            document.body.removeChild(textarea);
            setCopiedState(true);
            setTimeout(() => setCopiedState(false), 2000); // Reset 'Copied!' message after 2 seconds
        } catch (err) {
            console.error('Failed to copy text: ', err);
            setErrorMessage('Failed to copy text to clipboard.');
        }
    };

    // Function to handle the image processing (OCR and Translation)
    const handleProcessImage = async () => {
        if (!selectedImage) {
            setErrorMessage('Please select an image first.');
            return;
        }

        setIsLoading(true); // Set loading state to true
        setErrorMessage(''); // Clear previous error messages
        setExtractedHindiText(''); // Clear previous extracted text
        setTranslatedText(''); // Clear previous translated text
        setCopiedExtracted(false); // Reset copied state
        setCopiedTranslated(false); // Reset copied state

        try {
            const base64ImageData = dataURLtoBase64(imagePreviewUrl); // Get plain base64 image data

            // --- Step 1: Extract Hindi text using Gemini API (Image Understanding) ---
            const ocrPrompt = "Extract all Hindi text from this image. Only provide the Hindi text, nothing else.";
            const ocrPayload = {
                contents: [
                    {
                        role: "user",
                        parts: [
                            { text: ocrPrompt },
                            {
                                inlineData: {
                                    mimeType: selectedImage.type, // Use the actual MIME type of the image
                                    data: base64ImageData
                                }
                            }
                        ]
                    }
                ],
            };

            const apiKey = ""; // Canvas will provide this at runtime
            const ocrApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

            const ocrResponse = await fetch(ocrApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ocrPayload)
            });

            const ocrResult = await ocrResponse.json();

            let hindiText = '';
            // Enhanced check for content and parts
            if (ocrResult.candidates && ocrResult.candidates.length > 0 &&
                ocrResult.candidates[0].content && ocrResult.candidates[0].content.parts &&
                ocrResult.candidates[0].content.parts.length > 0) {
                hindiText = ocrResult.candidates[0].content.parts[0].text;
                setExtractedHindiText(hindiText); // Display the extracted Hindi text
            } else {
                // More specific error message for OCR failure
                setErrorMessage('Failed to extract Hindi text. This might be due to low-quality image, blurry text, or no Hindi text detected. Please try another image or ensure it contains clear Hindi text.');
                setIsLoading(false);
                return;
            }

            // --- Step 2: Translate the extracted Hindi text using Gemini API (Text Generation) ---
            if (hindiText) {
                const translationPrompt = `Translate the following Hindi text into ${targetLanguage === 'en' ? 'English' : 'Bengali'}: \n\n"${hindiText}"`;
                const translationPayload = {
                    contents: [{ role: "user", parts: [{ text: translationPrompt }] }],
                };

                const translationApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

                const translationResponse = await fetch(translationApiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(translationPayload)
                });

                const translationResult = await translationResponse.json();

                // Enhanced check for content and parts
                if (translationResult.candidates && translationResult.candidates.length > 0 &&
                    translationResult.candidates[0].content && translationResult.candidates[0].content.parts &&
                    translationResult.candidates[0].content.parts.length > 0) {
                    setTranslatedText(translationResult.candidates[0].content.parts[0].text); // Display the translated text
                } else {
                    setErrorMessage('Failed to translate text. The translation service might be unavailable or unable to process the extracted text. Please try again.');
                }
            } else {
                setErrorMessage('No Hindi text was extracted to translate.');
            }

        } catch (error) {
            console.error('Error processing image:', error);
            setErrorMessage('An unexpected error occurred during processing. Please check your network connection or try again later.');
        } finally {
            setIsLoading(false); // Reset loading state
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center p-4 font-sans">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-4xl border border-gray-200">
                <h1 className="text-4xl font-extrabold text-center text-gray-800 mb-8">
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                        Hindi Text Extractor & Translator
                    </span>
                </h1>

                {/* Image Upload Section */}
                <div className="mb-6 border-b pb-6 border-gray-200">
                    <label htmlFor="image-upload" className="block text-gray-700 text-lg font-semibold mb-2">
                        Upload Image with Hindi Text
                    </label>
                    <input
                        id="image-upload"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                            setSelectedImage(e.target.files[0]);
                            setErrorMessage(''); // Clear error when a new file is selected
                            setExtractedHindiText('');
                            setTranslatedText('');
                            setCopiedExtracted(false); // Reset copied state
                            setCopiedTranslated(false); // Reset copied state
                        }}
                        className="block w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 cursor-pointer focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {imagePreviewUrl && (
                        <div className="mt-4 text-center">
                            <h3 className="text-gray-700 text-md font-medium mb-2">Image Preview:</h3>
                            <img
                                src={imagePreviewUrl}
                                alt="Image Preview"
                                className="max-w-full h-auto rounded-lg shadow-md mx-auto border border-gray-300"
                                style={{ maxHeight: '300px' }}
                            />
                        </div>
                    )}
                </div>

                {/* Language Selection and Process Button */}
                <div className="flex flex-col sm:flex-row items-center justify-between mb-8 space-y-4 sm:space-y-0 sm:space-x-4">
                    <div className="w-full sm:w-1/2">
                        <label htmlFor="target-language" className="block text-gray-700 text-lg font-semibold mb-2">
                            Translate to:
                        </label>
                        <select
                            id="target-language"
                            value={targetLanguage}
                            onChange={(e) => setTargetLanguage(e.target.value)}
                            className="block w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 ease-in-out"
                        >
                            <option value="en">English</option>
                            <option value="bn">Bengali</option>
                        </select>
                    </div>
                    <div className="w-full sm:w-1/2 flex justify-end">
                        <button
                            onClick={handleProcessImage}
                            disabled={isLoading || !selectedImage}
                            className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold rounded-lg shadow-lg hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Processing...</span>
                                </>
                            ) : (
                                <span>Process Image</span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Error Message Display */}
                {errorMessage && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
                        <strong className="font-bold">Error! </strong>
                        <span className="block sm:inline">{errorMessage}</span>
                    </div>
                )}

                {/* Results Display Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Extracted Hindi Text */}
                    <div className="bg-gray-50 p-6 rounded-lg shadow-inner border border-gray-200">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center justify-between">
                            <span className="flex items-center">
                                <svg className="w-6 h-6 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                                Extracted Hindi Text
                            </span>
                            {extractedHindiText && (
                                <button
                                    onClick={() => handleCopyToClipboard(extractedHindiText, setCopiedExtracted)}
                                    className="px-3 py-1 bg-blue-500 text-white text-sm font-semibold rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 transition duration-200 ease-in-out relative"
                                >
                                    {copiedExtracted ? 'Copied!' : 'Copy'}
                                    {copiedExtracted && (
                                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs px-2 py-1 rounded-full animate-fade-in-out">
                                            Copied!
                                        </span>
                                    )}
                                </button>
                            )}
                        </h2>
                        <div className="bg-white p-4 rounded-md border border-gray-300 min-h-[100px] max-h-[300px] overflow-y-auto text-gray-900 leading-relaxed">
                            {extractedHindiText ? (
                                <p className="whitespace-pre-wrap">{extractedHindiText}</p>
                            ) : (
                                <p className="text-gray-500 italic">No Hindi text extracted yet. Upload an image and click "Process Image".</p>
                            )}
                        </div>
                    </div>

                    {/* Translated Text */}
                    <div className="bg-gray-50 p-6 rounded-lg shadow-inner border border-gray-200">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center justify-between">
                            <span className="flex items-center">
                                <svg className="w-6 h-6 mr-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 21h7a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v12a2 2 0 002 2h7l-2 2z"></path></svg>
                                Translated Text ({targetLanguage === 'en' ? 'English' : 'Bengali'})
                            </span>
                            {translatedText && (
                                <button
                                    onClick={() => handleCopyToClipboard(translatedText, setCopiedTranslated)}
                                    className="px-3 py-1 bg-purple-500 text-white text-sm font-semibold rounded-md hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-300 transition duration-200 ease-in-out relative"
                                >
                                    {copiedTranslated ? 'Copied!' : 'Copy'}
                                    {copiedTranslated && (
                                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs px-2 py-1 rounded-full animate-fade-in-out">
                                            Copied!
                                        </span>
                                    )}
                                </button>
                            )}
                        </h2>
                        <div className="bg-white p-4 rounded-md border border-gray-300 min-h-[100px] max-h-[300px] overflow-y-auto text-gray-900 leading-relaxed">
                            {translatedText ? (
                                <p className="whitespace-pre-wrap">{translatedText}</p>
                            ) : (
                                <p className="text-gray-500 italic">Translated text will appear here.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Copyright Section */}
               <div className="mt-8 pt-6 border-t border-gray-200 text-center text-gray-600 text-sm">
                    &copy; {new Date().getFullYear()} <a href="https://www.linkedin.com/in/diya-dutta-463b25334" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Diya Dutta</a>. All rights reserved.
                </div>
            </div>
        </div>
    );
};

export default App;
