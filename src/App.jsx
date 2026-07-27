import { Routes, Route } from 'react-router-dom'
import ScrollToTop from './components/ScrollToTop'
import Home from './pages/Home'
import Shop from './pages/Shop'
import Trait from './pages/Trait'
import Weakness from './pages/Weakness'
import Lookbook from './pages/Lookbook'
import Archive from './pages/Archive'
import About from './pages/About'
import Contact from './pages/Contact'
import Cart from './pages/Cart'
import IndexPage from './pages/IndexPage'
import './App.css'

function App() {
  return (
    <div className="page">
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/trait" element={<Trait />} />
        <Route path="/weakness" element={<Weakness />} />
        <Route path="/lookbook" element={<Lookbook />} />
        <Route path="/archive" element={<Archive />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/index" element={<IndexPage />} />
      </Routes>
    </div>
  )
}

export default App
