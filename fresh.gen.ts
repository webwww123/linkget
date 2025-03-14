// DO NOT EDIT. This file is generated by Fresh.
// This file SHOULD be checked into source version control.
// This file is automatically updated during development when running `dev.ts`.

import * as $_404 from "./routes/_404.tsx";
import * as $_app from "./routes/_app.tsx";
import * as $api_extract from "./routes/api/extract.ts";
import * as $api_favorites from "./routes/api/favorites.ts";
import * as $api_joke from "./routes/api/joke.ts";
import * as $greet_name_ from "./routes/greet/[name].tsx";
import * as $index from "./routes/index.tsx";
import * as $Counter from "./islands/Counter.tsx";
import * as $FavoriteLinks from "./islands/FavoriteLinks.tsx";
import * as $HierarchicalLinks from "./islands/HierarchicalLinks.tsx";
import * as $LinkExtractor from "./islands/LinkExtractor.tsx";
import type { Manifest } from "$fresh/server.ts";

const manifest = {
  routes: {
    "./routes/_404.tsx": $_404,
    "./routes/_app.tsx": $_app,
    "./routes/api/extract.ts": $api_extract,
    "./routes/api/favorites.ts": $api_favorites,
    "./routes/api/joke.ts": $api_joke,
    "./routes/greet/[name].tsx": $greet_name_,
    "./routes/index.tsx": $index,
  },
  islands: {
    "./islands/Counter.tsx": $Counter,
    "./islands/FavoriteLinks.tsx": $FavoriteLinks,
    "./islands/HierarchicalLinks.tsx": $HierarchicalLinks,
    "./islands/LinkExtractor.tsx": $LinkExtractor,
  },
  baseUrl: import.meta.url,
} satisfies Manifest;

export default manifest;
