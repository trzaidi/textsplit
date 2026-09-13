# TextSplit

TextSplit is a free tool that automatically separates large textbook PDFs into individual chapter files.

TextSplit first searches the PDF’s bookmarks for chapter boundaries. If usable chapter bookmarks are unavailable, it searches the beginning of each page for chapter headings.

All PDF processing happens locally on your computer. TextSplit does not upload, store, or transmit your textbook.

## Features

- Splits large textbook PDFs into individual chapters
- Detects chapters using PDF bookmarks
- Falls back to searching page text for chapter headings
- Supports PDFs with any filename
- Lets users choose between multiple PDFs
- Accepts a PDF path from anywhere on the computer
- Preserves the original PDF
- Creates a separate output folder automatically
- Works on Windows, macOS, and Linux
- Does not upload PDF content anywhere

## Requirements

TextSplit requires:

- Python 3.10 or newer
- The free `pypdf` Python package

## Easy Windows Setup

No Git or coding experience is required.

### Step 1: Download TextSplit

1. Select the green **Code** button at the top of this GitHub repository.
2. Select **Download ZIP**.
3. Open your Downloads folder.
4. Right-click the downloaded ZIP file.
5. Select **Extract All**.
6. Open the extracted `textsplit` folder.

### Step 2: Install Python

If Python is not already installed:

1. Visit [python.org/downloads](https://www.python.org/downloads/).
2. Download Python.
3. Open the installer.
4. Select **Add Python to PATH** if that option appears.
5. Complete the installation.

### Step 3: Add a Textbook

Copy the textbook PDF into the extracted `textsplit` folder.

Do not delete or rename the following files:

```text
split_chapters.py
requirements.txt
Start TextSplit.bat
```

### Step 4: Start TextSplit

Double-click:

```text
Start TextSplit.bat
```

The launcher will:

1. Find Python.
2. Install the required `pypdf` package if necessary.
3. Start TextSplit.
4. Display the available PDFs.
5. Ask which textbook you want to split.

### Step 5: Find the Chapters

TextSplit creates a new folder beside the original PDF:

```text
Textbook Name - Chapters
```

The original textbook remains unchanged.

## Command-Line Installation

Developers and command-line users can clone the repository:

```bash
git clone https://github.com/trzaidi/textsplit.git
cd textsplit
```

Install the dependency:

```bash
python -m pip install -r requirements.txt
```

On Windows, if `python` is unavailable but `py` works, use:

```powershell
py -m pip install -r requirements.txt
```

## Command-Line Usage

### Option 1: Place PDFs in the TextSplit Folder

Place one or more PDFs in the repository folder, then run:

```bash
python split_chapters.py
```

If only one PDF is present, TextSplit selects it automatically.

If multiple PDFs are present, TextSplit displays a numbered list:

```text
PDF files found:

1. Biology Textbook.pdf
2. Calculus Textbook.pdf

Enter the textbook number:
```

### Option 2: Provide a PDF Path

You can process a PDF located anywhere on your computer:

```bash
python split_chapters.py "path/to/My Textbook.pdf"
```

Windows example:

```powershell
python split_chapters.py "C:\Users\YourName\Documents\My Textbook.pdf"
```

macOS example:

```bash
python3 split_chapters.py "/Users/YourName/Documents/My Textbook.pdf"
```

Linux example:

```bash
python3 split_chapters.py "/home/YourName/Documents/My Textbook.pdf"
```

Always use quotation marks when the path or filename contains spaces.

## Example Output

Input:

```text
Calculus Textbook.pdf
```

Output:

```text
Calculus Textbook - Chapters/
├── Chapter 1 - Functions and Models.pdf
├── Chapter 2 - Limits and Derivatives.pdf
├── Chapter 3 - Differentiation Rules.pdf
└── ...
```

## How Chapter Detection Works

TextSplit checks for chapter boundaries in this order:

1. PDF bookmarks with titles such as `Chapter 1`
2. Searchable page text containing chapter headings

The beginning of the next chapter marks the end of the current chapter.

For the final chapter, TextSplit looks for end matter such as:

- Appendix
- Appendixes
- Appendices
- Index
- Glossary
- References
- Bibliography

If no end matter is detected, the final chapter continues to the end of the PDF.

## Privacy

TextSplit runs locally on your computer.

It does not:

- Upload your PDF
- Send PDF content over the internet
- Store your textbook on an external server
- Require a user account
- Collect personal information

An internet connection may be needed the first time the launcher installs `pypdf`.

## Limitations

Automatic chapter detection may fail when:

- The PDF is made entirely from scanned images
- The PDF has no bookmarks
- The pages contain no searchable text
- Chapter headings use an unusual format
- The PDF is encrypted
- The PDF is damaged
- The bookmarks point to incorrect pages

Image-only PDFs usually require optical character recognition (OCR) before TextSplit can search their page text.

## Troubleshooting

### Python Was Not Found

Install Python from:

[https://www.python.org/downloads/](https://www.python.org/downloads/)

During installation, select **Add Python to PATH** if the option appears. Close and reopen the terminal after installing Python.

### No PDF Files Were Found

Either:

- Place a PDF in the same folder as `split_chapters.py`, or
- Provide the complete PDF path through the command line.

### No Chapter Boundaries Were Detected

The PDF may not contain usable bookmarks or searchable chapter headings. Check whether you can select and copy text from the PDF. If you cannot, the PDF may require OCR.

### Permission Denied

Close the PDF in other programs and try again. Also confirm that you have permission to create files in the textbook’s folder.

### The PDF Filename Contains Spaces

Place the complete path inside quotation marks:

```bash
python split_chapters.py "My Large Textbook.pdf"
```

## Repository Files

```text
textsplit/
├── split_chapters.py
├── Start TextSplit.bat
├── requirements.txt
├── README.md
├── LICENSE
└── .gitignore
```

## Copyright

TextSplit does not include or distribute textbook files.

Only process PDFs that you are legally permitted to use. Do not commit or upload copyrighted textbooks or generated chapter files to this repository.

Users are responsible for ensuring they have permission to process their PDFs. PDF files and generated chapter folders are excluded from this repository through `.gitignore`.

## Contributing

Bug reports, suggestions, and pull requests are welcome.

When reporting a chapter-detection problem, do not upload a copyrighted textbook. Describe the PDF’s bookmark structure and chapter-heading format instead.

## License

TextSplit is released under the MIT License.