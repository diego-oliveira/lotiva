import puppeteer from 'puppeteer'

export async function generatePDFFromHTML(html: string): Promise<Buffer> {
  let browser
  
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
    })
    
    const page = await browser.newPage()
    
    await page.setContent(html, {
      waitUntil: 'networkidle0'
    })
    
    const pdf = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      },
      printBackground: true,
      preferCSSPageSize: true
    })
    
    return pdf
  } catch (error) {
    console.error('Error generating PDF:', error)
    throw new Error('Failed to generate PDF')
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

export async function generateContractPDF(contractData: any): Promise<Buffer> {
  const { generateContractPDFHTML } = await import('./contractGenerator')
  const html = generateContractPDFHTML(contractData)
  return generatePDFFromHTML(html)
}