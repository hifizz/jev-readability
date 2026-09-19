# Empty-reference audit before model calls

The frozen cohort includes SPA pages 4922 (empty main_content) and 4285 (null main_content, explicitly marked unextractable). Retain both under the historical empty-target scoring convention for the all-140 comparison; publish a separate 138-nonempty-reference sensitivity view. Do not infer that these pages have annotated semantic content. Blank anchor arrays do not count as a perfect annotated page. No sample IDs are replaced.

Source: pinned WCXB test/ground-truth/4922.json and 4285.json. Null is accepted only when the upstream record explicitly marks the page unextractable. Gold labels are still never used to bypass extraction or select a model result.
