import { asset, Head } from "$fresh/runtime.ts";
import LinkExtractor from "../islands/LinkExtractor.tsx";
import HierarchicalLinks from "../islands/HierarchicalLinks.tsx";

export default function Home() {
  return (
    <>
      <Head>
        <title>链接提取器 - LinkGet</title>
        <meta name="description" content="快速提取网页链接，方便整理和收藏" />
        <link rel="stylesheet" href={asset("/styles.css")} />
      </Head>
      <div class="min-h-screen bg-gray-100">
        <nav class="bg-white shadow-sm p-4">
          <div class="max-w-screen-lg mx-auto flex justify-between">
            <a href="/" class="font-bold text-xl">LinkGet</a>
            <div class="space-x-4">
              <a href="/" class="font-medium text-blue-600">链接提取</a>
              <a href="/docsearch" class="hover:text-blue-600">文档搜索</a>
            </div>
          </div>
        </nav>
        
        <LinkExtractor />
        <HierarchicalLinks />
      </div>
    </>
  );
}
