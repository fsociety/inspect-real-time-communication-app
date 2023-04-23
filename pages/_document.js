import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html>
        <Head>
            <script src="/assets/js/settings.js"></script>
            <script src="/assets/js/janus.js"></script>
        </Head>
        <body>
            <Main />
            <NextScript />
        </body>
    </Html>
  )
}