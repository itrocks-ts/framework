
if (document.body.dataset.fixture === 'standalone') {
	await import('/@itrocks/custom-list/custom-list.js')
	await import('/@itrocks/custom-list/build.js')
}
else {
	await import('/@itrocks/framework/app.js')
	document.addEventListener('itrocks:list-ready', event => { window.listReady = event.detail })
	if (document.querySelector('article[data-action=list]')) await import('/@itrocks/list/build.js')
}
window.ready = true
