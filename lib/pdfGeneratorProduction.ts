import puppeteerCore from 'puppeteer-core';

let chromium: any;

// Dynamic import for serverless environments
async function getChromium() {
  if (!chromium) {
    try {
      chromium = await import('@sparticuz/chromium');
      return chromium;
    } catch (error) {
      console.log('Chromium package not available');
      return null;
    }
  }
  return chromium;
}

export async function generatePDFFromHTMLProduction(
  html: string
): Promise<Buffer> {
  let browser;
  const isProduction =
    process.env.NODE_ENV === 'production' || process.env.VERCEL;

  try {
    console.log('Starting PDF generation...', { isProduction });

    if (isProduction) {
      // Production environment (Vercel)
      const chromiumPackage = await getChromium();

      if (chromiumPackage) {
        console.log('Using @sparticuz/chromium for production');
        browser = await puppeteerCore.launch({
          args: chromiumPackage.default.args,
          defaultViewport: chromiumPackage.default.defaultViewport,
          executablePath: await chromiumPackage.default.executablePath(),
          headless: chromiumPackage.default.headless
        });
      } else {
        throw new Error('Chromium not available in production');
      }
    } else {
      // Development environment - use puppeteer-core with local Chrome
      console.log('Using puppeteer-core for development');

      // Try to find local Chrome installation
      const possiblePaths = [
        process.env.CHROME_PATH, // Allow custom Chrome path via environment variable
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
        '/usr/bin/google-chrome-stable', // Linux
        '/usr/bin/google-chrome', // Linux
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Windows
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' // Windows
      ].filter(Boolean); // Remove undefined values

      let executablePath = '';
      for (const path of possiblePaths) {
        if (!path) continue; // Skip undefined paths
        try {
          const fs = await import('fs');
          if (fs.existsSync(path)) {
            executablePath = path;
            console.log('Found Chrome at:', path);
            break;
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
            ]
          });
        } catch (autoFindError) {
          throw new Error(
            `Chrome not found. Please install Google Chrome or set CHROME_PATH environment variable. Error: ${
              autoFindError instanceof Error
                ? autoFindError.message
                : 'Unknown error'
            }`
          );
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
          ]
        });
      }
    }

    console.log('Browser launched successfully');
    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    console.log('HTML content set successfully');

    // Set viewport for consistent rendering
    await page.setViewport({
      width: 794, // A4 width in pixels at 96 DPI
      height: 1123 // A4 height in pixels at 96 DPI
    });

    console.log('Generating PDF...');
    const pdf = await page.pdf({
      format: 'A4',
      margin: {
        top: '30mm', // 3cm - ABNT standard
        right: '20mm', // 2cm - ABNT standard
        bottom: '20mm', // 2cm - ABNT standard
        left: '30mm' // 3cm - ABNT standard
      },
      printBackground: true,
      preferCSSPageSize: false, // Let PDF control the page size
      displayHeaderFooter: false,
      scale: 1.0, // Ensure 100% scale
      timeout: 30000
    });

    console.log('PDF generated successfully, size:', pdf.length);
    return Buffer.from(pdf);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error(
      `Failed to generate PDF: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log('Browser closed successfully');
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
  }
}

export async function generateContractPDFProduction(
  contractData: any
): Promise<Buffer> {
  const { generateContractPDFHTML } = await import('./contractGenerator');
  const html = generateContractPDFHTML(contractData);
  return generatePDFFromHTMLProduction(html);
}
