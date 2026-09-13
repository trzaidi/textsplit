import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader, PdfWriter

from split_chapters import split_textbook


class TextSplitTests(unittest.TestCase):
    def test_splits_pdf_using_chapter_bookmarks(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            temporary_path = Path(temporary_directory)
            source_pdf = temporary_path / "Sample Textbook.pdf"

            writer = PdfWriter()

            for _ in range(6):
                writer.add_blank_page(width=612, height=792)

            writer.add_outline_item(
                "Chapter 1: Beginning",
                page_number=0,
            )
            writer.add_outline_item(
                "Chapter 2: Continuing",
                page_number=3,
            )
            writer.add_outline_item(
                "Appendixes",
                page_number=5,
            )

            with source_pdf.open("wb") as output_file:
                writer.write(output_file)

            split_textbook(source_pdf)

            chapter_folder = (
                temporary_path
                / "Sample Textbook - Chapters"
            )

            chapter_files = sorted(
                chapter_folder.glob("*.pdf")
            )

            self.assertEqual(len(chapter_files), 2)

            first_chapter = PdfReader(chapter_files[0])
            second_chapter = PdfReader(chapter_files[1])

            self.assertEqual(len(first_chapter.pages), 3)
            self.assertEqual(len(second_chapter.pages), 2)


if __name__ == "__main__":
    unittest.main()
