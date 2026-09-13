import logging
import re
from pathlib import Path

from pypdf import PdfReader, PdfWriter


logging.getLogger("pypdf").setLevel(logging.ERROR)

CHAPTER_PATTERN = re.compile(
    r"^\s*(?:chapter|chap\.?)\s+([0-9]+|[ivxlcdm]+)\b[.: -]*(.*)",
    re.IGNORECASE,
)

END_MATTER_PATTERN = re.compile(
    r"^\s*(appendix|appendixes|appendices|index|glossary|references|bibliography)\b",
    re.IGNORECASE,
)


def safe_filename(name):
    name = re.sub(r'[<>:"/\\|?*]', "-", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name.rstrip(". ")


def find_pdfs():
    return sorted(
        path
        for path in Path.cwd().glob("*.pdf")
        if path.is_file()
    )


def choose_pdf(pdf_files):
    if not pdf_files:
        raise FileNotFoundError(
            "No PDF files were found in this folder."
        )

    if len(pdf_files) == 1:
        print(f"Using: {pdf_files[0].name}")
        return pdf_files[0]

    print("PDF files found:\n")

    for number, path in enumerate(pdf_files, start=1):
        print(f"{number}. {path.name}")

    while True:
        choice = input("\nEnter the textbook number: ").strip()

        if choice.isdigit():
            index = int(choice) - 1

            if 0 <= index < len(pdf_files):
                return pdf_files[index]

        print("Enter one of the numbers shown above.")


def get_outline_entries(reader):
    entries = []

    def read_items(items):
        for item in items:
            if isinstance(item, list):
                read_items(item)
                continue

            try:
                title = str(item.title).strip()
                page_index = reader.get_destination_page_number(item)

                if page_index is not None:
                    entries.append((title, page_index))
            except Exception:
                continue

    try:
        read_items(reader.outline)
    except Exception:
        pass

    entries.sort(key=lambda entry: entry[1])
    return entries


def remove_duplicate_pages(entries):
    results = []
    used_pages = set()

    for title, page_index in sorted(entries, key=lambda item: item[1]):
        if page_index not in used_pages:
            results.append((title, page_index))
            used_pages.add(page_index)

    return results


def chapters_from_bookmarks(reader):
    entries = get_outline_entries(reader)
    chapters = []

    for title, page_index in entries:
        if CHAPTER_PATTERN.match(title):
            chapters.append((title, page_index))

    chapters = remove_duplicate_pages(chapters)

    if not chapters:
        return [], None

    last_chapter_page = chapters[-1][1]
    end_page = None

    for title, page_index in entries:
        if (
            page_index > last_chapter_page
            and END_MATTER_PATTERN.match(title)
        ):
            end_page = page_index
            break

    return chapters, end_page


def chapters_from_page_text(reader):
    chapters = []

    print("No usable chapter bookmarks found.")
    print("Searching page text for chapter headings...")

    for page_index, page in enumerate(reader.pages):
        try:
            text = page.extract_text() or ""
        except Exception:
            continue

        lines = [
            line.strip()
            for line in text.splitlines()
            if line.strip()
        ]

        for line in lines[:12]:
            match = CHAPTER_PATTERN.match(line)

            if match:
                title = line[:100]
                chapters.append((title, page_index))

                print(
                    f"Found {title!r} on PDF page "
                    f"{page_index + 1}"
                )
                break

    return remove_duplicate_pages(chapters)


def split_textbook(pdf_path):
    print(f"\nReading: {pdf_path.name}")

    reader = PdfReader(pdf_path)

    print(f"Total pages: {len(reader.pages)}")

    chapters, end_page = chapters_from_bookmarks(reader)

    if chapters:
        print(
            f"Found {len(chapters)} chapters using bookmarks."
        )
    else:
        chapters = chapters_from_page_text(reader)
        end_page = None

    if not chapters:
        print("\nNo chapter boundaries could be detected.")
        print(
            "This PDF may contain scanned images without "
            "bookmarks or searchable text."
        )
        return

    if end_page is None:
        end_page = len(reader.pages)

    output_folder = Path(
        safe_filename(f"{pdf_path.stem} - Chapters")
    )

    output_folder.mkdir(exist_ok=True)

    print(f"\nOutput folder: {output_folder}\n")

    for index, (title, start_page) in enumerate(chapters):
        if index + 1 < len(chapters):
            stop_page = chapters[index + 1][1]
        else:
            stop_page = end_page

        if stop_page <= start_page:
            continue

        writer = PdfWriter()

        for page_index in range(start_page, stop_page):
            writer.add_page(reader.pages[page_index])

        chapter_number = index + 1
        filename = safe_filename(title)

        if not filename.lower().startswith("chapter"):
            filename = (
                f"Chapter {chapter_number} - {filename}"
            )

        output_path = output_folder / f"{filename}.pdf"

        with output_path.open("wb") as output_file:
            writer.write(output_file)

        print(
            f"Created: {output_path.name} "
            f"(PDF pages {start_page + 1}-{stop_page})"
        )

    print(
        f"\nFinished. Created {len(chapters)} chapter files."
    )


def main():
    try:
        pdf_files = find_pdfs()
        selected_pdf = choose_pdf(pdf_files)
        split_textbook(selected_pdf)

    except FileNotFoundError as error:
        print(f"\nError: {error}")

    except KeyboardInterrupt:
        print("\nOperation cancelled.")

    except Exception as error:
        print(f"\nUnexpected error: {error}")


if __name__ == "__main__":
    main()