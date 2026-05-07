const { getPdf } = require('../service/convert')

// Cache header max age
const maxAge = 24 * 60 * 60
const allowedHosts = (process.env.ALLOWED_HOSTS || '')
	.split(',')
	.map((host) => host.trim().toLowerCase())
	.filter(Boolean)

const isAllowedUrl = (input) => {
	try {
		const parsed = new URL(input)
		if (!['http:', 'https:'].includes(parsed.protocol)) return false
		if (allowedHosts.length === 0) return true

		return allowedHosts.some((host) => {
			if (host.startsWith('*.')) {
				const suffix = host.slice(1)
				return parsed.hostname.toLowerCase().endsWith(suffix)
			}

			return parsed.hostname.toLowerCase() === host
		})
	} catch (_) {
		return false
	}
}

module.exports = async (req, res) => {
	try {
		// Only allow GET requests
		if (req.method !== 'GET') return res.status(405).end()

		const queryUrl = Array.isArray(req.query?.url) ? req.query.url[0] : req.query?.url
		const url = queryUrl || req.url
			.replace(/^\/+/, '')
			.replace(/^api\/?/, '')
			.replace(/^https:\//i, 'https://')
			.replace(/^http:\//i, 'http://')

		// Block favicon.ico requests from reaching puppeteer
		if (url === 'favicon.ico') return res.status(404).end()
		if (!url) return res.status(400).send('Error: missing url')
		if (!isAllowedUrl(url)) return res.status(400).send('Error: URL is not allowed')

		console.log(`Converting: ${ url }`)
		const pdfBuffer = await getPdf(url)

		if (!pdfBuffer) return res.status(400).send('Error: could not generate PDF')

		// Instruct browser to cache PDF for maxAge ms
		if (process.env.NODE_ENV !== 'development') res.setHeader('Cache-control', `public, max-age=${ maxAge }`)

		// Set Content type to PDF and send the PDF to the client
		res.setHeader('Content-type', 'application/pdf')
		res.send(pdfBuffer)

	} catch (err) {
		if (err.message === 'Protocol error (Page.navigate): Cannot navigate to invalid URL')
			return res.status(404).end()

		console.error(err)
		res.status(500).send('Error: Please try again.')
	}
}
