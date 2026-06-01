import { readFileSync } from 'fs'
import { join } from 'path'

export default function Home() {
  const html = readFileSync(join(process.cwd(), 'public', 'lp.html'), 'utf-8')
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/)
  const headMatch = html.match(/<head>([\s\S]*)<\/head>/)

  // Extract CSS and script links from head
  const cssLinks = headMatch?.[1]?.match(/<link[^>]*rel="stylesheet"[^>]*>/g) || []
  const scriptTags = headMatch?.[1]?.match(/<script[^>]*>[\s\S]*?<\/script>/g) || []
  const styleTags = headMatch?.[1]?.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []

  const headContent = [...cssLinks, ...styleTags, ...scriptTags].join('\n')
  const bodyContent = bodyMatch?.[1] || ''

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: headContent }} suppressHydrationWarning />
      <div dangerouslySetInnerHTML={{ __html: bodyContent }} suppressHydrationWarning />
    </>
  )
}
