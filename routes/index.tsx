import { asset, Head } from "$fresh/runtime.ts";
import LinkExtractor from "../islands/LinkExtractor.tsx";
import FavoriteLinks from "../islands/FavoriteLinks.tsx";

export default function Home() {
  return (
    <>
      <Head>
        <title>链接提取器 - 收集网页上的所有链接</title>
        <meta name="description" content="一个简单的工具，帮助你从任何网页中提取所有链接，并允许保存收藏。" />
        <link rel="stylesheet" href={asset("/styles.css")} />
      </Head>
      <main>
        <div class="p-4 mx-auto max-w-screen-md">
          <LinkExtractor />
          <FavoriteLinks />
        </div>
      </main>
    </>
  );
}
