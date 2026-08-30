#!/usr/bin/env python3
"""Convert Vorkurs Markdown collections to task-level Sokrates imports."""

from __future__ import annotations

import json
import re
import shutil
from dataclasses import dataclass, field
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SOURCE_ROOT = ROOT / "sammlungen"
OUTPUT_ROOT = ROOT / "importable"

SECTION_RE = re.compile(r"^####\s+Schwierigkeit\s+(\d+)\s*:\s*$", re.MULTILINE)
CATEGORY_RE = re.compile(r"^\*\*([A-Z])\*\*\s*:?\s*$")
TASK_RE = re.compile(r"^(?:\*\*)?\(([0-9]+|[A-Z])\)(?:\*\*)?\s*(.*)$")
MARKDOWN_LINK_RE = re.compile(r"\[([^\]]+)]\(([^)]+)\)")
TABLE_SEPARATOR_RE = re.compile(r"^\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$")
OUTER_SOLUTION_RE = re.compile(r"^#?\*?\{(.*)}\*?\s*$", re.DOTALL)
ROMAN_EQUATION_RE = re.compile(r"^(I|II|III|IV)\.\s+(.+)$")


@dataclass
class MarkdownTask:
    difficulty: str
    category: str
    source_number: str
    ordinal: int
    lines: list[str] = field(default_factory=list)

    @property
    def display_number(self) -> str:
        return self.source_number if self.source_number.isdigit() else str(self.ordinal)

    @property
    def short_label(self) -> str:
        return f"{self.category}{self.display_number}"


def topic_name(path: Path, markdown: str) -> str:
    heading = re.search(r"^##\s+(.+?)\s*$", markdown, re.MULTILINE)
    topic = heading.group(1).strip() if heading else path.stem.replace("-", " ").title()
    return {
        "potenzgesetze": "Potenzgesetze",
        # This source accidentally repeats the heading "Wurzeln".
        "primzahlsatz": "Primzahlen und Teilbarkeit",
    }.get(path.stem, topic)


def repair_math_delimiters(value: str) -> str:
    positions = [
        index
        for index, character in enumerate(value)
        if character == "$" and (index == 0 or value[index - 1] != "\\")
    ]
    if len(positions) % 2 == 0:
        return value
    # One source line has a complete equation followed by an orphan trailing `$`.
    if len(positions) == 3 and value.rstrip().endswith("$"):
        trailing = value.rfind("$")
        return value[:trailing] + value[trailing + 1 :]
    raise ValueError(f"Unbalanced math delimiters: {value}")


def normalize_latex_commands(value: str) -> str:
    """Repair a small set of unambiguous source-level LaTeX mistakes."""
    value = re.sub(r"\\prod\{([^{}]+)}", r"\\prod_{\1}", value)
    value = re.sub(r"(?<!\\)\bln(?=\s*\()", r"\\ln", value)
    return value


def strip_markdown_outside_math(value: str) -> str:
    result: list[str] = []
    in_math = False
    index = 0
    while index < len(value):
        character = value[index]
        if character == "$" and (index == 0 or value[index - 1] != "\\"):
            in_math = not in_math
            result.append(character)
            index += 1
            continue
        if not in_math and value.startswith("**", index):
            index += 2
            continue
        if not in_math and character == "*":
            index += 1
            continue
        result.append(character)
        index += 1
    return "".join(result)


def clean_text_line(value: str) -> str:
    value = repair_math_delimiters(value.strip())
    value = MARKDOWN_LINK_RE.sub(r"\1 (\2)", value)
    value = value.replace("``", '"').replace("''", '"')
    value = strip_markdown_outside_math(value)
    value = normalize_latex_commands(value)
    roman = ROMAN_EQUATION_RE.match(value)
    if roman and "$" not in roman.group(2):
        value = f"{roman.group(1)}. ${roman.group(2).strip()}$"
    return value.strip()


def clean_solution(value: str) -> str | None:
    match = OUTER_SOLUTION_RE.match(value.strip())
    if not match:
        return None
    solution = clean_text_line(match.group(1).strip()).strip("*").strip()
    return f"Lösung: {solution}" if solution else "Lösung"


def parse_instructions(intro: str) -> dict[str, str]:
    instructions: dict[str, str] = {}
    for raw_line in intro.replace("\r\n", "\n").splitlines():
        line = raw_line.strip()
        if not line or TABLE_SEPARATOR_RE.match(line) or "$" in line or "|" not in line:
            continue
        cells = [clean_text_line(cell) for cell in line.strip("|").split("|")]
        if len(cells) >= 2 and re.fullmatch(r"[A-Z]", cells[0]):
            instructions[cells[0]] = " — ".join(cells[1:]).strip()
    return instructions


def split_sections(markdown: str) -> tuple[str, list[tuple[str, str]]]:
    matches = list(SECTION_RE.finditer(markdown))
    intro_start = markdown.find("\n") + 1
    intro_end = matches[0].start() if matches else len(markdown)
    sections: list[tuple[str, str]] = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(markdown)
        sections.append((match.group(1), markdown[match.end() : end]))
    return markdown[intro_start:intro_end], sections


def parse_tasks(difficulty: str, section: str) -> list[MarkdownTask]:
    tasks: list[MarkdownTask] = []
    current_category = "A"
    current_task: MarkdownTask | None = None
    category_counts: dict[str, int] = {}

    def flush() -> None:
        nonlocal current_task
        if current_task is not None:
            tasks.append(current_task)
            current_task = None

    for raw_line in section.replace("\r\n", "\n").splitlines():
        line = raw_line.strip()
        category_match = CATEGORY_RE.fullmatch(line)
        if category_match:
            flush()
            current_category = category_match.group(1)
            continue

        task_match = TASK_RE.match(line)
        if task_match:
            flush()
            category_counts[current_category] = category_counts.get(current_category, 0) + 1
            current_task = MarkdownTask(
                difficulty=difficulty,
                category=current_category,
                source_number=task_match.group(1),
                ordinal=category_counts[current_category],
            )
            remainder = task_match.group(2).strip()
            if remainder:
                current_task.lines.append(remainder)
            continue

        if current_task is not None:
            current_task.lines.append(raw_line)

    flush()
    return tasks


def task_plain_text(task: MarkdownTask, instruction: str | None) -> tuple[str, bool]:
    paragraphs: list[str] = []
    pending_solution: list[str] = []

    if instruction:
        paragraphs.append(f"Aufgabentyp {task.category}: {instruction}")
    else:
        paragraphs.append(f"Aufgabentyp {task.category}")

    def discard_solution() -> None:
        if not pending_solution:
            return
        pending_solution.clear()

    for raw_line in task.lines:
        line = raw_line.strip()
        if not line or line.lower() in {"<br>", "<br/>", "<br />"}:
            discard_solution()
            continue
        if pending_solution:
            pending_solution.append(line)
            if re.search(r"}\*?\s*$", line):
                discard_solution()
            continue
        if re.match(r"^#?\*?\{", line):
            pending_solution.append(line)
            if re.search(r"}\*?\s*$", line):
                discard_solution()
            continue
        cleaned_line = clean_text_line(line)
        if cleaned_line.casefold().startswith("lösung"):
            continue
        if line.startswith(">"):
            paragraphs.append(f"Hinweis: {clean_text_line(line[1:].strip())}")
            continue
        paragraphs.append(cleaned_line)
    discard_solution()

    content_only = " ".join(paragraphs[1:])
    placeholder_key = re.sub(r"[\s$*{}#:.\-]", "", content_only).casefold()
    is_placeholder = placeholder_key in {"", "lösungantwort", "antwort"}
    if is_placeholder:
        paragraphs = [
            paragraphs[0],
            "Die Aufgabe ist in der Markdown-Quelle noch nicht ausgefüllt.",
        ]
    return "\n".join(paragraphs), is_placeholder


def iter_math_expressions(value: str) -> list[str]:
    expressions: list[str] = []
    in_math = False
    start = 0
    index = 0
    while index < len(value):
        if value[index] == "$" and (index == 0 or value[index - 1] != "\\"):
            if in_math:
                expressions.append(value[start:index])
            else:
                start = index + 1
            in_math = not in_math
        index += 1
    if in_math:
        raise ValueError(f"Unbalanced generated math delimiters: {value}")
    return expressions


def convert_file(path: Path) -> dict[str, object]:
    markdown = path.read_text(encoding="utf-8-sig")
    topic = topic_name(path, markdown)
    intro, sections = split_sections(markdown)
    instructions = parse_instructions(intro)
    relative_id = path.relative_to(SOURCE_ROOT).with_suffix("").as_posix()
    problems: list[dict[str, object]] = []

    for difficulty, section in sections:
        for task in parse_tasks(difficulty, section):
            plain_text, is_placeholder = task_plain_text(
                task, instructions.get(task.category)
            )
            problems.append(
                {
                    "id": (
                        f"{relative_id}-d{difficulty}-"
                        f"{task.category.casefold()}{task.display_number}"
                    ),
                    "title": f"Aufgabe {task.short_label} (Schwierigkeit {difficulty})",
                    **({"status": "DRAFT"} if is_placeholder else {}),
                    "plainText": plain_text,
                    "chapterName": (
                        f"{topic} — S{difficulty} · {task.short_label}"
                    ),
                }
            )

    if not problems:
        raise ValueError(f"No numbered tasks found in {path}")
    return {"version": 1, "problems": problems}


def validate_document(document: dict[str, object], source: Path) -> None:
    if set(document) != {"version", "problems"} or document["version"] != 1:
        raise ValueError(f"Invalid document envelope for {source}")
    problems = document["problems"]
    if not isinstance(problems, list) or not 1 <= len(problems) <= 500:
        raise ValueError(f"Invalid problem count for {source}")

    seen_ids: set[str] = set()
    allowed_keys = {"id", "title", "status", "plainText", "chapterName"}
    for index, problem in enumerate(problems):
        if not isinstance(problem, dict) or set(problem) - allowed_keys:
            raise ValueError(f"Invalid problem shape at {source}:{index}")
        problem_id = problem.get("id")
        if not isinstance(problem_id, str) or not 1 <= len(problem_id) <= 128:
            raise ValueError(f"Invalid problem id at {source}:{index}")
        if problem_id in seen_ids:
            raise ValueError(f"Duplicate problem id {problem_id} in {source}")
        seen_ids.add(problem_id)
        for key, max_length in (("title", 200), ("chapterName", 200)):
            value = problem.get(key)
            if not isinstance(value, str) or not value.strip() or len(value) > max_length:
                raise ValueError(f"Invalid {key} at {source}:{index}")
        content = problem.get("plainText")
        if not isinstance(content, str) or not content.strip() or len(content) > 100_000:
            raise ValueError(f"Invalid plainText at {source}:{index}")
        for expression in iter_math_expressions(content):
            if not expression.strip():
                raise ValueError(f"Empty math expression at {source}:{index}")
            if "\\prod{" in expression or re.search(r"(?<!\\)\bln\s*\(", expression):
                raise ValueError(f"Unnormalized LaTeX at {source}:{index}: {expression}")


def main() -> None:
    markdown_files = sorted(SOURCE_ROOT.glob("*/*.md"))
    if not markdown_files:
        raise SystemExit(f"No Markdown files found below {SOURCE_ROOT}")
    if OUTPUT_ROOT.exists():
        shutil.rmtree(OUTPUT_ROOT)

    manifest: list[tuple[str, str, int]] = []
    for source in markdown_files:
        document = convert_file(source)
        validate_document(document, source)
        relative_output = source.relative_to(SOURCE_ROOT).with_suffix(".json")
        output = OUTPUT_ROOT / relative_output
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(
            json.dumps(document, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        manifest.append(
            (
                relative_output.as_posix(),
                topic_name(source, source.read_text(encoding="utf-8-sig")),
                len(document["problems"]),
            )
        )

    readme_lines = [
        "# Importierbare Vorkurs-Aufgaben",
        "",
        "Jede JSON-Datei entspricht dem Inhalt eines Kurs-Tabs. Jede nummerierte",
        "Markdown-Aufgabe wird als eigenes Kapitel und damit als eigener Kartenstein",
        "importiert. Schwierigkeitsgrad, Aufgabentyp und Aufgabenstellung bleiben",
        "erhalten; Lösungen verbleiben ausschließlich in den Markdown-Quelldateien.",
        "Noch leere Quellaufgaben werden ausdrücklich als Entwurf markiert.",
        "",
        "| Datei | Empfohlener Tabname | Aufgaben/Kapitel |",
        "| --- | --- | ---: |",
    ]
    readme_lines.extend(
        f"| `{filename}` | {topic} | {problem_count} |"
        for filename, topic, problem_count in manifest
    )
    readme_lines.extend(
        [
            "",
            "Die Dateien verwenden Version 1 des strikten Sokrates-JSON-Imports.",
            "Erneute Generierung: `python3 VorkursAufgaben/convert_markdown_imports.py`.",
            "",
        ]
    )
    (OUTPUT_ROOT / "README.md").write_text("\n".join(readme_lines), encoding="utf-8")

    total_problems = sum(problem_count for _, _, problem_count in manifest)
    print(f"Generated {len(manifest)} imports with {total_problems} task chapters in {OUTPUT_ROOT}")


if __name__ == "__main__":
    main()
