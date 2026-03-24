import pypdf
import json
import sys

def extract_pdf_info(pdf_path):
    try:
        reader = pypdf.PdfReader(pdf_path)
        num_pages = len(reader.pages)
        
        # Extract first 3 pages and some middle/end pages to get a feel
        text_samples = []
        for i in range(min(5, num_pages)):
            text_samples.append(f"--- Page {i+1} ---\n" + reader.pages[i].extract_text()[:1000])
        
        info = {
            "num_pages": num_pages,
            "samples": text_samples
        }
        print(json.dumps(info, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        extract_pdf_info(sys.argv[1])
    else:
        print("Usage: python script.py <pdf_path>")
