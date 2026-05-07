import chromium from '@sparticuz/chromium-min'
import puppeteer from 'puppeteer-core'

const chromiumPackUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
	? `https://${ process.env.VERCEL_PROJECT_PRODUCTION_URL }/chromium-pack.tar`
	: 'https://github.com/gabenunez/puppeteer-on-vercel/raw/refs/heads/main/example/chromium-dont-use-in-prod.tar'

let cachedExecutablePath = null
let executablePathPromise = null

const getExecutablePath = async () => {
	if (cachedExecutablePath) return cachedExecutablePath

	if (!executablePathPromise) {
		executablePathPromise = chromium.executablePath(chromiumPackUrl)
			.then((path) => {
				cachedExecutablePath = path
				return path
			})
			.catch((error) => {
				executablePathPromise = null
				throw error
			})
	}

	return executablePathPromise
}

export const getPdf = async (url) => {
	const executablePath = await getExecutablePath()
	const browser = await puppeteer.launch({
		args: chromium.args,
		executablePath,
		headless: true
	})

	try {
		const page = await browser.newPage()
		await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 })

		await page.evaluate(async () => {
			await new Promise((resolve) => {
				let totalHeight = 0
				const distance = 100
				const timer = setInterval(() => {
					const scrollHeight = document.body.scrollHeight
					window.scrollBy(0, distance)
					totalHeight += distance

					if (totalHeight >= scrollHeight) {
						clearInterval(timer)
						resolve()
					}
				}, 5)
			})
		})

		await page.emulateMediaType('screen')

		return page.pdf({
			format: 'A4',
			displayHeaderFooter: false,
			printBackground: true,
			preferCSSPageSize: true
		})
	} finally {
		await browser.close()
	}
}
