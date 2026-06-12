import puppeteerCore from 'puppeteer-core'

let chromium: any

// Dynamic import for serverless environments
async function getChromium() {
  if (!chromium) {
    try {
      chromium = await import('@sparticuz/chromium')
      return chromium
    } catch (error) {
      console.log('Chromium package not available');
      return null
    }
  }
  return chromium
}

export async function generatePDFFromHTMLProduction(
  html: string
): Promise<Buffer> {
  let browser
  const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL)

  try {
    console.log('Starting PDF generation...', { isProduction })

    if (isProduction) {
      // Production environment (Vercel)
      const chromiumPackage = await getChromium()

      if (chromiumPackage) {
        console.log('Using @sparticuz/chromium for production')
        browser = await puppeteerCore.launch({
          args: chromiumPackage.default.args,
          defaultViewport: chromiumPackage.default.defaultViewport,
          executablePath: await chromiumPackage.default.executablePath(),
          headless: chromiumPackage.default.headless,
        })
      } else {
        throw new Error('Chromium not available in production')
      }
    } else {
      // Development environment - use puppeteer-core with local Chrome
      console.log('Using puppeteer-core for development')

      // Try to find local Chrome installation
      const possiblePaths = [
        process.env.CHROME_PATH, // Allow custom Chrome path via environment variable
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
        '/usr/bin/google-chrome-stable', // Linux
        '/usr/bin/google-chrome', // Linux
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Windows
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' // Windows
      ].filter(Boolean)

      let executablePath = ''
      for (const path of possiblePaths) {
        if (!path) continue
        try {
          const fs = await import('fs')
          if (fs.existsSync(path)) {
            executablePath = path
            console.log('Found Chrome at:', path)
            break
          }
        } catch (error) {
          // Continue searching
        }
      }

      if (!executablePath) {
        console.log(
          'Chrome not found in standard locations, trying system PATH'
        );
        // If no Chrome found, let puppeteer try to find it automatically
        try {
          browser = await puppeteerCore.launch({
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-accelerated-2d-canvas',
              '--no-first-run',
              '--no-zygote',
              '--single-process',
              '--disable-gpu',
              '--disable-web-security',
              '--disable-features=VizDisplayCompositor'
          ],
        })
        } catch (autoFindError) {
          throw new Error(
            `Chrome not found. Please install Google Chrome or set CHROME_PATH environment variable. Error: ${
              autoFindError instanceof Error
                ? autoFindError.message
                : 'Unknown error'
            }`
          )
        }
      } else {
        browser = await puppeteerCore.launch({
          executablePath: executablePath,
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
          ],
        })
      }
    }

    console.log('Browser launched successfully')
    const page = await browser.newPage()

    page.setDefaultNavigationTimeout(15000)
    page.setDefaultTimeout(15000)
    await page.setViewport({
      width: 794,
      height: 1123,
    })

    await page.setContent(html, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    })

    // The contract uses local/system fonts. Wait for font layout without
    // depending on Chrome's network-idle heuristic, which can hang on setContent.
    await page.evaluate(async () => {
      if ('fonts' in document) {
        await Promise.race([
          document.fonts.ready,
          new Promise((resolve) => window.setTimeout(resolve, 2000)),
        ])
      }
    })
    await page.emulateMediaType('print')

    console.log('HTML content set successfully')
    console.log('Generating PDF...')
    const pdf = await page.pdf({
      format: 'A4',
      margin: {
        top: '30mm',
        right: '20mm',
        bottom: '20mm',
        left: '30mm',
      },
      printBackground: true,
      preferCSSPageSize: false,
      displayHeaderFooter: false,
      scale: 1,
      timeout: 30000,
    })

    console.log('PDF generated successfully, size:', pdf.length)
    return Buffer.from(pdf)
  } catch (error) {
    console.error('Error generating PDF:', error)
    throw new Error(
      `Failed to generate PDF: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    )
  } finally {
    if (browser) {
      try {
        await browser.close()
        console.log('Browser closed successfully')
      } catch (closeError) {
        console.error('Error closing browser:', closeError)
      }
    }
  }
}

export async function generateContractPDFProduction(
  contractData: any
): Promise<Buffer> {
  const { generateContractPDFHTML } = await import('./contractGenerator')
  const html = generateContractPDFHTML(contractData)
  return generatePDFFromHTMLProduction(html)
}
