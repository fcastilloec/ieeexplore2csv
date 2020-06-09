const xl = require('excel4node')

const IEEEURL = 'https://ieeexplore.ieee.org/document/'

/**
 * Creates an excel file on disk based on an array of results.
 *
 * @param  {object[]]}  results      The results from scrapping IEEE, each result is an Object inside this array.
 * @param  {string}     xlsFilename  The path and filename where to save the Excel file.
 */
function json2xls (results, xlsFilename) {
  const wb = new xl.Workbook()
  const ws = wb.addWorksheet('Sheet 1')

  // ws.cell(row, col)
  ws.cell(1, 1).string('YEAR').style({ font: { bold: true } })
  ws.cell(1, 2).string('TITLE').style({ font: { bold: true } })
  ws.cell(1, 3).string('AUTHORS').style({ font: { bold: true } })
  ws.cell(1, 4).string('JOURNAL').style({ font: { bold: true } })
  ws.cell(1, 5).string('ABSTRACT').style({ font: { bold: true } })
  ws.cell(1, 6).string('IEEE URL').style({ font: { bold: true } })

  for (let i = 0; i < results.length; i++) {
    ws.cell(i + 2, 1).number(parseInt(results[i].year))
    ws.cell(i + 2, 2).string(results[i].title)
    ws.cell(i + 2, 3).string(results[i].authors.join('; '))
    ws.cell(i + 2, 4).string(results[i].journal)
    ws.cell(i + 2, 5).string(results[i].abstract)
    if (results[i].document !== '') ws.cell(i + 2, 6).link(IEEEURL + results[i].document)
  }

  wb.write(xlsFilename)
}

module.exports = json2xls
