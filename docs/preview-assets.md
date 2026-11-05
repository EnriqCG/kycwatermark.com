# Preview images

The landing page's sample ID, the final “how it works” card and the strength
thumbnails use `renderWatermarkPreview` in `src/rendering/watermarkPreview.ts`.
It calls the production renderer with the editor's shared defaults and a fixed
example seed. Strength thumbnails show a magnified crop of each preset. The
landing page's draft preview uses the current editor settings directly.

Two committed images also need refreshing after changes to the default pattern:

- `docs/screenshot-editor.png`: capture the running editor at a **1440 × 1000
  CSS pixel viewport with device scale factor 2**, producing a **2880 × 2000 PNG**.
  Check both `innerWidth` / `innerHeight` and the saved image dimensions; some
  capture tools export CSS pixels even when the device scale factor is 2.
  Keep this viewport so the controls retain their original readable scale.
  Choose the sample ID, cover its document number, address and bottom code strip,
  then enter “Acme Bank” with Identity check, today's date, Woven and Bold selected.
  Leave Fine-tune collapsed and the settings panel scrolled to the top.
- `public/og-image.jpg`: generate the 1200 × 630 share card from the current sample,
  header logo, fonts and production renderer using the module below. Preserve
  the original card placement, type scale and privacy badge. The example's date
  and seed are fixed so repeated renders use the same pattern.

With `pnpm dev` running, open the app and run this in its browser console:

```js
const { renderShareImage } = await import('/scripts/render-share-image.mjs');
const canvas = await renderShareImage();
const link = document.createElement('a');
link.href = canvas.toDataURL('image/jpeg', 0.92);
link.download = 'og-image.jpg';
link.click();
```

Replace `public/og-image.jpg` with the download, inspect both images, and bump
the `?v=` suffix on the Open Graph and Twitter image URLs in `index.html` so
share services can refresh their cached copy. Update their alt text and the
README's screenshot description if the depicted behavior changes.
