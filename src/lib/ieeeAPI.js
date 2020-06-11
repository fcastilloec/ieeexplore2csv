const axios = require('axios').default
const https = require('https')
const puppeteer = require('puppeteer')
const createJSON = require('./createJson')

/**
 * Search by scrapping the results from the IEEE search page.
 *
 * @param   {string}  query  The search terms. See querytext from https://developer.ieee.org/docs/read/Metadata_API_details
 *
 * @return  {object[]}       All the IEEE results from each page, from 'createJson' function.
 */
async function scrap (query) {
  const ieeeUrl = 'https://ieeexplore.ieee.org/search/searchresult.jsp?queryText='
  const ELEMENTS = 'div.row.result-item.hide-mobile > div.col.result-item-align'
  const NEXT = 'div.ng-SearchResults.row > div.main-section > xpl-paginator > div.pagination-bar.hide-mobile > ul > li.next-btn > a'
  const PAGES = 'div.ng-SearchResults.row > div.main-section > xpl-paginator > div.pagination-bar.hide-mobile > ul > li:not(.prev-btn):not(.next-btn):not(.next-page-set)'// .next-btn .next-page-set)'

  let browser
  try {
    browser = await puppeteer.launch({ headless: true })
    const page = await browser.newPage()
    page.setDefaultTimeout(10000) // only wait 10 secs, any longer and it means there's no results
    await page.goto(ieeeUrl + query)
    await page.waitForSelector(ELEMENTS) // Wait until javascript loads all results
    const results = await page.evaluate(createJSON) // create JSON with results of first page

    // TODO: check what happens when a single page of results or no results happen
    const totalPages = (await page.$$(PAGES)).length // check how many result pages exist
    for (let i = 0; i < totalPages - 1; i++) {
      await page.click(NEXT) // go to next page of results
      await page.waitForSelector(ELEMENTS) // wait for results to load
      const pageResult = await page.evaluate(createJSON)
      results.push(...pageResult) // add page results to original object
    }
    await browser.close() // close browser

    return results
  } catch (error) {
    await browser.close()
    if (error instanceof puppeteer.errors.TimeoutError) {
      return []
    } else {
      console.error('Error scrapping results:\n' + error.message)
      process.exit(2)
    }
  }
}

/**
 * Search using the IEEE API
 *
 * @param   {string}  apiKey     The API key
 * @param   {string}  querytext  The query string
 * @param   {number}  startYear  Start year of publication to restrict results by.
 * @param   {number}  endYear    End year of publication to restrict results by.
 *
 * @return  {object}             The results, it has three keys: total_records, total_searched, articles
 */
async function api (apiKey, querytext, startYear, endYear) {
  const APIURL = 'https://ieeexploreapi.ieee.org/api/v1/search/articles'

  const config = {
    method: 'get',
    baseURL: APIURL,
    responseType: 'json',
    httpsAgent: new https.Agent({
      rejectUnauthorized: false
    }),
    paramsSerializer: params => {
      let result = ''
      Object.keys(params).forEach(key => {
        result += `${key}=${encodeURIComponent(params[key])}&`
      })
      return result.substr(0, result.length - 1)
    },
    params: {
      querytext: `${querytext}`,
      max_records: 200,
      apikey: apiKey
    }
  }
  if (startYear) config.params.start_year = startYear
  if (endYear) config.params.end_year = endYear

  try {
    const response = await axios(config)
    return response.data
  } catch (error) {
    console.error('Error with IEEE API:\n' + error.message)
    process.exit(3)
  }
}

module.exports = {
  scrap,
  api
}
