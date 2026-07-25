const TOKEN = '3a1bd0a1-8460-4548-8e55-bb0ef8ec49ff'

async function gql(query, variables = {}) {
  const res = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  })
  const d = await res.json()
  if (d.errors) throw new Error(JSON.stringify(d.errors))
  return d.data
}

// Intentar con projects directo
const data = await gql(`{
  projects {
    edges {
      node {
        id name
        services {
          edges {
            node { id name }
          }
        }
      }
    }
  }
}`)

console.log('Raw:', JSON.stringify(data, null, 2))
