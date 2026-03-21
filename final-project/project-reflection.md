# Final Project — Neon Building Overlay

## The Idea

I wanted to make a piece inspired by Bruno Imbrizi's work, where coded shapes are overlaid on a static photograph. The idea was to take a photo of the old soviet circus building in my home city and have neon green geometric shapes trace its dark regions, animated with a noise-driven sweep so they appear and fade organically across the frame. The goal was to have the shapes had to feel intentional, clearly following the architecture of the building itself. This however was not fully achieved, but 3 attempts remain as trials.


## Attempt 1: Noise-Driven Block Grid

![Alt text](sketch-noise-image.gif)


In the first attempt, I divided the canvas into a grid of cells and sampled the average brightness of the building photo in each cell. Cells below a darkness threshold got a neon green rectangle drawn over them. I used `random.noise3D` to stagger the timing of each block's appearance, creating a sweep effect.

I used an offscreen canvas to read pixel data with `getImageData`, then computed brightness with the standard weighted formula (`0.299R + 0.587G + 0.114B`). The animation used a cyclic timer where each cell's reveal was delayed by a noise offset, and the block scaled up from small to full size over time.

The problem was that it of course does not follow the actual contours of the building at all. 


## Attempt 2: Marching Squares Contour Lines

![Alt text](sketch-noise-image2.gif)


For the second attempt, I switched to the marching squares algorithm to extract actual contour lines from the brightness data. Instead of sampling per grid cell, I built a high-resolution brightness grid (220 points across) and ran marching squares at four different thresholds (45, 80, 115, 155) to capture multiple layers of darkness.


The contour segments were grouped by noise visibility into three buckets for performance, and drawn as stroked lines with a neon glow (using `shadowBlur`). The noise sweep from attempt 1 was used again (`random.noise3D`).

The result was much closer to what I wanted. The lines clearly traced the dark shapes in the building. But it was too detailed and squiggly because of the high grid resolution, and I wanted to see the dark areas filled in, not just their outlines.


## Attempt 3: Marching Squares Filled Polygons

![Alt text](sketch-noise-image3.gif)

The final attempt kept the marching squares approach but made two major changes: I lowered the grid resolution to 75 (giving chunkier, more geometric shapes) and switched from drawing contour lines to filling polygons.

This required building a completely different lookup table. Instead of the edge table from attempt 2 (which mapped each of the 16 cases to line segment pairs), I created a fill table (`FILL`) that mapped each case to one or more polygons defined by vertex indices. Vertices 0–3 are the four corners of the cell; vertices 4–7 are interpolated points along the four edges. A `vertexPos` function resolves each vertex ID to actual canvas coordinates, handling both corner vertices and edge-interpolated ones.

I used three brightness thresholds (55, 95, 140) to create layered depth , the darkest regions get the most opaque green, while lighter shadows get a subtler overlay. The layers render back to front so the darkest, most opaque shapes sit on top.

The noise sweep animation works the same way as before, but now it reveals filled shapes instead of lines. The shapes are clearly geometric (thanks to the coarser grid) but still follow the building's actual dark regions because marching squares respects the brightness boundaries.
