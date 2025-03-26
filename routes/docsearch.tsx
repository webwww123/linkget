import { asset, Head } from "$fresh/runtime.ts";
import DocSearch from "../islands/DocSearch.tsx";

export default function DocSearchPage() {
  return (
    <>
      <Head>
        <title>文档智能搜索 - LinkGet</title>
        <link rel="stylesheet" href={asset("/styles.css")} />
      </Head>
      <div class="min-h-screen bg-gray-100">
        <nav class="bg-white shadow-sm p-4">
          <div class="max-w-screen-lg mx-auto flex justify-between">
            <a href="/" class="font-bold text-xl">LinkGet</a>
            <div class="space-x-4">
              <a href="/" class="hover:text-blue-600">链接提取</a>
              <a href="/docsearch" class="font-medium text-blue-600">文档搜索</a>
            </div>
          </div>
        </nav>
        
        <DocSearch />
      </div>
    </>
  );
} 