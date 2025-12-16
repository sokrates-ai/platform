#!/usr/bin/env python3

import argparse
import sys
from typing import Iterable, Optional

import requests
from bs4 import BeautifulSoup

DEFAULT_USER_AGENT = "invlect-parser/0.1 (+https://example.com)"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch a web page and optionally extract elements via a CSS selector."
    )
    parser.add_argument("url", help="URL to fetch")
    parser.add_argument(
        "-s",
        "--selector",
        help="CSS selector used to narrow the output to specific elements",
    )
    parser.add_argument(
        "-a",
        "--attribute",
        help="Optional attribute to read from each matched element",
    )
    parser.add_argument(
        "-m",
        "--max-items",
        type=int,
        help="Limit the number of matching elements returned",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=15.0,
        help="HTTP request timeout in seconds (default: 15)",
    )
    parser.add_argument(
        "--user-agent",
        default=DEFAULT_USER_AGENT,
        help=f"User-Agent header to send (default: {DEFAULT_USER_AGENT})",
    )
    return parser.parse_args()


def fetch(url: str, timeout: float, user_agent: str) -> str:
    headers = {"User-Agent": user_agent}
    try:
        response = requests.get(url, headers=headers, timeout=timeout)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise SystemExit(f"Request failed: {exc}") from exc
    return response.text


def stringify_elements(elements: Iterable, attribute: Optional[str]) -> str:
    collected = []
    for element in elements:
        if attribute:
            value = element.get(attribute)
            if value is None:
                continue
            collected.append(value)
        else:
            collected.append(element.get_text(separator=" ", strip=True))
    return "\n".join(collected)


def extract(html: str, selector: Optional[str], attribute: Optional[str], limit: Optional[int]) -> str:
    if not selector:
        return html

    soup = BeautifulSoup(html, "lxml")
    matches = soup.select(selector)
    if not matches:
        return ""

    if limit is not None:
        matches = matches[:limit]
    return stringify_elements(matches, attribute)


def main() -> None:
    args = parse_args()
    html = fetch(args.url, args.timeout, args.user_agent)
    output = extract(html, args.selector, args.attribute, args.max_items)
    if not output:
        return
    sys.stdout.write(output.rstrip("\n") + "\n")


if __name__ == "__main__":
    main()
