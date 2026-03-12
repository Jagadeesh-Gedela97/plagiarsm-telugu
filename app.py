from flask import Flask, request, jsonify, render_template
import re
import requests
from bs4 import BeautifulSoup
from sentence_transformers import SentenceTransformer, util
import os 
from werkzeug.utils import secure_filename
from werkzeug.exceptions import HTTPException  # ✅ FIXED
import PyPDF2
import docx
import io

import docx
import PyPDF2
from io import BytesIO   # ✅ ADD THIS
app = Flask(__name__)

# File upload configuration
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

ALLOWED_EXTENSIONS = {'txt', 'pdf', 'docx', 'doc'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# -----------------------------
# CLEANING
# -----------------------------
def clean_telugu(text):
    text = re.sub(r'[^\u0C00-\u0C7F\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def split_sentences(text):
    # Split on Telugu danda and common sentence-ending punctuation
    raw_sentences = re.split(r'[।\.?!]+', text)
    return [s.strip() for s in raw_sentences if s.strip()]

# -----------------------------
# FILE TEXT EXTRACTION
# -----------------------------
def extract_text_from_file(file):
    print(f"[DEBUG] Extracting text from file: {file.filename}")

    if file.filename.endswith('.txt'):
        return extract_text_from_txt(file)

    elif file.filename.endswith('.pdf'):
        return extract_text_from_pdf(file)

    elif file.filename.endswith('.docx'):
        return extract_text_from_docx(file)

    return ""


def extract_text_from_txt(file):
    try:
        file.stream.seek(0)
        return file.read().decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"[DEBUG] TXT extraction failed: {e}")
        return ""


def extract_text_from_pdf(file):
    try:
        file.stream.seek(0)
        file_bytes = file.read()
        pdf_reader = PyPDF2.PdfReader(BytesIO(file_bytes))

        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() or ""

        return text

    except Exception as e:
        print(f"[DEBUG] PDF extraction failed: {e}")
        return ""


def extract_text_from_docx(file):
    try:
        file.stream.seek(0)
        file_bytes = file.read()

        document = docx.Document(BytesIO(file_bytes))

        text = ""
        for para in document.paragraphs:
            text += para.text + "\n"

        return text

    except Exception as e:
        print(f"[DEBUG] DOCX extraction failed: {e}")
        return ""


# -----------------------------
# MORPHOLOGICAL NORMALIZATION
# -----------------------------
TELUGU_SUFFIXES = ["లు","లో","కు","ని","తో","గా","పై","డం","మైన","ల","యి","ను"]

def telugu_stem(word):
    for suf in TELUGU_SUFFIXES:
        if word.endswith(suf) and len(word) > len(suf) + 2:
            return word[:-len(suf)]
    return word

def morph_normalize(text):
    tokens = text.split()
    stems = [telugu_stem(t) for t in tokens]
    return " ".join(stems)

# -----------------------------
# SERPER SEARCH
# -----------------------------
SERPER_KEY = "a0b606b09c9be74ce2b8333e0c879077aa699cc7"

def search_serper(query):
    print(f"[DEBUG] Searching for query: {query}")
    print(f"[DEBUG] SERPER_KEY configured: {bool(SERPER_KEY and SERPER_KEY != 'your_api')}")
    
    url = "https://google.serper.dev/search"
    payload = {"q": query, "gl": "in", "hl": "te"}
    headers = {
        "X-API-KEY": SERPER_KEY,
        "Content-Type": "application/json"
    }

    try:
        print(f"[DEBUG] Making request to {url}")
        res = requests.post(url, json=payload, headers=headers, timeout=10)
        print(f"[DEBUG] Response status: {res.status_code}")
        
        if res.status_code != 200:
            print(f"[DEBUG] Error response: {res.text}")
            return get_fallback_urls()
            
        data = res.json()
        print(f"[DEBUG] Response data keys: {list(data.keys())}")
        print(f"[DEBUG] Organic results count: {len(data.get('organic', []))}")
        
        urls = [item["link"] for item in data.get("organic", [])[:5]]
        
        # If no URLs found, provide fallback
        if not urls:
            print(f"[DEBUG] No URLs found, using fallback")
            urls = get_fallback_urls()
        
        print(f"[DEBUG] Extracted URLs: {urls}")
        return urls
    except Exception as e:
        print(f"[DEBUG] Search exception: {e}")
        return get_fallback_urls()

def get_fallback_urls():
    """Provide fallback URLs for demonstration when no search results are found"""
    print("[DEBUG] Using fallback URLs")
    return [
        "https://te.wikipedia.org/wiki/తెలుగు_భాష",
        "https://telugu.news18.com/",
        "https://telugu.asianetnews.com/",
        "https://www.tv9telugu.com/",
        "https://sakshi.com/"
    ]

# -----------------------------
# EXTRACT TELUGU TEXT
# -----------------------------
def extract_telugu_text(url):
    try:
        res = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
        if not res.text or len(res.text) < 200:
            return ""

        soup = BeautifulSoup(res.text, "html.parser")

        # Remove non-content tags before extracting text
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()

        text = soup.get_text(separator=" ")
        telugu_only = re.findall(r'[\u0C00-\u0C7F\s]+', text)

        return " ".join(telugu_only)
    except Exception as e:
        print(f"[DEBUG] Error extracting from {url}: {e}")
        return ""

# -----------------------------
# MODEL LOAD (once at startup)
# -----------------------------
model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")

# -----------------------------
# JACCARD
# -----------------------------
def jaccard_similarity(text1, text2):
    set1 = set(text1.split())
    set2 = set(text2.split())

    if not set1 or not set2:
        return 0

    intersection = len(set1 & set2)
    union = len(set1 | set2)

    if union == 0:
        return 0

    return intersection / union

# -----------------------------
# SIMILARITY
# -----------------------------
def similarity_scores(input_text, source_text):
    norm1 = morph_normalize(input_text)
    norm2 = morph_normalize(source_text)

    emb1 = model.encode(norm1, convert_to_tensor=True)
    emb2 = model.encode(norm2, convert_to_tensor=True)
    semantic = util.cos_sim(emb1, emb2).item()

    jaccard = jaccard_similarity(norm1, norm2)
    final_score = (0.7 * jaccard) + (0.3 * semantic)

    return semantic, jaccard, final_score

# -----------------------------
# MAIN LOGIC
# -----------------------------
def telugu_plag_check(text):
    print(f"[DEBUG] Starting plagiarism check for text length: {len(text)}")
    cleaned = clean_telugu(text)
    sentences = split_sentences(cleaned)
    print(f"[DEBUG] Split into {len(sentences)} sentences")

    results = []

    for i, sent in enumerate(sentences):
        print(f"[DEBUG] Processing sentence {i+1}: {sent[:50]}...")
        urls = search_serper(sent)
        print(f"[DEBUG] Found {len(urls)} URLs")

        for j, url in enumerate(urls):
            print(f"[DEBUG] Processing URL {j+1}: {url}")
            web_text = extract_telugu_text(url)

            if not web_text:
                print(f"[DEBUG] No text extracted from URL")
                continue

            web_cleaned = clean_telugu(web_text)
            web_sentences = split_sentences(web_cleaned)

            # Simple debug prints
            print(f"[DEBUG] URL: {url}")
            print(f"[DEBUG] Extracted Telugu length: {len(web_cleaned)}")
            print(f"[DEBUG] Number of web sentences: {len(web_sentences)}")

            for k, web_sent in enumerate(web_sentences):
                semantic, jaccard, final_score = similarity_scores(sent, web_sent)

                print(f"[DEBUG] Sentence {i+1}-{j+1}-{k+1}: semantic={semantic:.3f}, jaccard={jaccard:.3f}, final={final_score:.3f}")

                # Only keep matches above threshold (temporarily lowered to 0.1)
                if final_score <= 0.1:
                    continue

                results.append({
                    "sentence": sent,
                    "url": url,
                    "semantic_score": round(semantic, 3),
                    "jaccard_score": round(jaccard, 3),
                    "final_score": round(final_score, 3)
                })

    print(f"[DEBUG] Total results before filtering: {len(results)}")
    results.sort(key=lambda x: x["final_score"], reverse=True)
    print(f"[DEBUG] Final results: {len(results)}")
    return results

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/about")
def about():
    return render_template("about.html")


@app.route("/check")
def check():
    return render_template("check.html")


@app.route("/analysis")
def analysis():
    return render_template("analysis.html")


# -----------------------------
# API ENDPOINT
# -----------------------------
@app.route("/plag-check", methods=["POST"])
def plag_check():
    data = request.get_json()

    if not data or "text" not in data:
        return jsonify({"error": "Provide text field"}), 400

    text = data["text"]
    results = telugu_plag_check(text)

    return jsonify({
        "matches": results,
        "total_matches": len(results)
    })

# -----------------------------
# FILE UPLOAD ENDPOINT
# -----------------------------
@app.route("/upload-check", methods=["POST"])
def upload_check():
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    if not allowed_file(file.filename):
        return jsonify({"error": "File type not allowed. Use txt, pdf, or docx"}), 400
    
    try:
        # Extract text from file
        text = extract_text_from_file(file)
        
        if not text or len(text.strip()) < 10:
            return jsonify({"error": "Could not extract text from file or file is empty"}), 400
        
        # Run plagiarism check
        results = telugu_plag_check(text)
        
        return jsonify({
            "matches": results,
            "total_matches": len(results),
            "extracted_text_length": len(text),
            "filename": file.filename
        })
        
    except Exception as e:
        return jsonify({"error": f"Error processing file: {str(e)}"}), 500

# -----------------------------
# TEXT EXTRACTION ENDPOINT
# -----------------------------
# -----------------------------
# TEXT EXTRACTION ENDPOINT
# -----------------------------
@app.route("/extract-text", methods=["POST"])
def extract_text():
    print("[DEBUG] Extract-text endpoint called")
    
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    if not allowed_file(file.filename):
        return jsonify({"error": "File type not allowed. Use txt, pdf, or docx"}), 400
    
    try:
        text = extract_text_from_file(file)
        
        if not text or len(text.strip()) < 10:
            return jsonify({"error": "Could not extract text"}), 400
        
        return jsonify({
            "extracted_text": text,
            "extracted_text_length": len(text),
            "filename": file.filename
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -----------------------------
# GLOBAL ERROR HANDLER (MUST BE OUTSIDE)
# -----------------------------
@app.errorhandler(Exception)
def handle_exception(e):
    if isinstance(e, HTTPException):
        return e
    return jsonify({"error": str(e)}), 500

# -----------------------------
# RUN SERVER
# -----------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)