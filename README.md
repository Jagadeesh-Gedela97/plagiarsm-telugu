# Telugu AI Plagiarism Detection System

This project is a web-based plagiarism detection system designed to analyze Telugu text and identify copied content from online sources.

## Features
- Detects plagiarism in Telugu text
- Uses semantic similarity to compare sentences
- Fetches web sources to verify copied content
- Displays similarity score for detected matches

## Technologies Used
- Python
- Flask
- NLP (Natural Language Processing)
- Sentence Transformers
- Serper Web Search API
- HTML
- CSS
- JavaScript

## How It Works
1. User enters Telugu text in the web interface.
2. The system cleans and splits the text into sentences.
3. Each sentence is compared using semantic similarity.
4. Web search is performed to find matching content online.
5. Similarity scores are calculated and displayed.

## Project Structure
telugu-ai-plagiarism-detection
│
├── app.py
├── requirements.txt
├── templates
├── static
└── README.md
