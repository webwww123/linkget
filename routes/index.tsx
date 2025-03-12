import { Head } from "$fresh/runtime.ts";
import LinkExtractor from "../islands/LinkExtractor.tsx";

export default function Home() {
  return (
    <>
      <Head>
        <title>链接提取器 - 抓取网页中的所有链接</title>
        <meta name="description" content="一个简单的工具，用于提取网页中的所有链接并去除不需要的部分" />
      </Head>
      <div class="p-4 mx-auto bg-gray-50 min-h-screen">
        <LinkExtractor />
        
        <footer class="mt-16 text-center text-gray-500 text-sm">
          <p>
            基于 <a href="https://fresh.deno.dev/" class="text-blue-600 hover:underline">Fresh</a> 和 
            <a href="https://deno.com/" class="text-blue-600 hover:underline">Deno</a> 构建
          </p>
        </footer>
      </div>
    </>
  );
}
