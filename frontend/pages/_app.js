import '../styles/globals.css'
import { AuthProvider } from '../context/AuthContext'
import Layout from '../components/Layout'

export default function App({ Component, pageProps }) {
  const getLayout = Component.getLayout || ((page) => <Layout>{page}</Layout>)

  return (
    <AuthProvider>
      {getLayout(<Component {...pageProps} />)}
    </AuthProvider>
  )
}
