const urql = require('urql')

const APIURL = 'https://api.thegraph.com/subgraphs/name/dispa1r/neargreeting'

const tokensQuery = `
query {
    account{
      id
    }
  }
`


async function Query(){
    const client = urql.createClient({
        url: APIURL,
      })
    const data = await client.query(tokensQuery).toPromise()
    console.log(data)
}

Query()