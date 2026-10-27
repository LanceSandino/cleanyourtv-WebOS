# Decisions for this fork

- [D-20261027-1] The fork's TVs update only from LanceSandino/cleanyourtv-WebOS (updater, themes, compatibility list, installer, Homebrew Channel listing); upstream changes arrive only through a reviewed merge into the fork — a root service must not pull unreviewed code from another owner's repository (status: active)
- [D-20261027-2] Fork releases are built locally from reviewed source with `python3 ipk/build.py` (CYTV_REPO=LanceSandino/cleanyourtv-WebOS) after `sh tools/check.sh` passes, and published to the fork with `gh release create`; the fork's tag of a version may point at a different commit than upstream's tag of the same name (status: active)
