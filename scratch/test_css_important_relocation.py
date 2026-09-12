#!/usr/bin/env python3
"""The CSS001 relocation exception must remain narrower than new !important."""
from pathlib import Path
from subprocess import run
from tempfile import TemporaryDirectory

from pre_write_linter import (
    get_relocated_player_tray_lines,
    relocated_player_tray_important_lines,
    scan_css_for_important,
)


def check(condition, description):
    assert condition, description
    print("  PASS: " + description)


source = """#layerPlayerTray.layer-player-tray {
    left: var(--layout-edge-gap);
    right: auto !important;
}
#layerPlayerTray .offering-section {
    margin: 0 !important;
}
@media (max-width: 768px) {
    #layerPlayerTray.layer-player-tray {
        left: 8px !important;
    }
}
"""
get_allowed = lambda old, new, old_count=3, new_count=3, new_source="", old_owner="": (
    relocated_player_tray_important_lines(
        old, new_source, old_owner, new, old_count, new_count)
)

allowed = get_allowed(source, source)
check(len(allowed) == 3, "same selector, context and declarations: exact moved lines allowed")
check(not get_allowed(source, source.replace("right: auto", "right: 0")),
      "changed declaration value fails")
check(not get_allowed(source, source.replace("right: auto", "width: auto")),
      "changed declaration property fails")
check(not get_allowed(source, source.replace("right: auto !important", "right: auto")),
      "removed priority fails")
check(not get_allowed(source, source.replace("max-width: 768px", "max-width: 767px")),
      "changed media condition fails")
check(not get_allowed(source, source.replace("#layerPlayerTray .offering-section",
                                            ".offering-section")),
      "different selector fails")
check(not get_allowed(source, source, new_source=source), "source rule not removed fails")
check(not get_allowed(source, source, old_owner=source), "rule already in owner fails")
check(not get_allowed(source, source, new_count=4), "increased total !important fails")

with TemporaryDirectory() as temp:
    path = Path(temp) / "tray.css"
    path.write_text(source + ".unrelated { color: red !important; }\n", encoding="utf-8")
    # A compensating removal elsewhere cannot authorize an unrelated addition.
    moved = get_allowed(source, path.read_text(encoding="utf-8"), old_count=4, new_count=4)
    added = {"game/css/3_bottom_area/draw_card_select_area.css":
             set(range(1, len(path.read_text(encoding="utf-8").splitlines()) + 1))}
    violations, _ = scan_css_for_important(
        path, "game/css/3_bottom_area/draw_card_select_area.css", added, moved)
    check(len(violations) == 1, "unrelated new !important still fails even when total is stable")
    violations, _ = scan_css_for_important(path, "game/css/another.css",
                                            {"game/css/another.css": added[
                                                "game/css/3_bottom_area/draw_card_select_area.css"]})
    check(len(violations) == 4, "other CSS files receive no exception")

root = Path(__file__).resolve().parent.parent
original = run(["git", "show", "HEAD:game/css/0_global_common/base_layout.css"],
               cwd=root, capture_output=True, text=True, check=True).stdout
expected = 8 if "#layerPlayerTray.layer-player-tray {" in original else 0
check(len(get_relocated_player_tray_lines(root)) == expected,
      "only pending, identical relocation allows the eight existing declarations")
print("CSS001 relocation: 12/12 PASS")
