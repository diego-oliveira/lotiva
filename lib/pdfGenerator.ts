import puppeteer from 'puppeteer';

export async function generatePDFFromHTML(html: string): Promise<Buffer> {
  let browser;

  try {
    console.log('Starting PDF generation...');
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
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

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

export async function generateContractPDF(contractData: any): Promise<Buffer> {
  const { generateContractPDFHTML } = await import('./contractGenerator');
  const html = generateContractPDFHTML(contractData);
  return generatePDFFromHTML(html);
}
