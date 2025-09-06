import puppeteer from 'puppeteer';

export async function generatePDFFromHTML(html: string): Promise<Buffer> {
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: 'networkidle0'
    });

    // Set viewport for consistent rendering
    await page.setViewport({
      width: 794, // A4 width in pixels at 96 DPI
      height: 1123 // A4 height in pixels at 96 DPI
    });

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
      scale: 1.0 // Ensure 100% scale
    });

    return Buffer.from(pdf);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF');
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export async function generateContractPDF(contractData: any): Promise<Buffer> {
  const { generateContractPDFHTML } = await import('./contractGenerator');
  const html = generateContractPDFHTML(contractData);
  return generatePDFFromHTML(html);
}
