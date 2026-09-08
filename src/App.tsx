import { useState } from 'react'
import type { FormEvent } from 'react'
import heroCasa from './assets/hero-casa.webp'
import residencial from './assets/residencial.webp'
import terreno from './assets/terreno.webp'
import './App.css'

const properties = [
  { title: 'Residencia contemporánea', location: 'Matehuala, San Luis Potosí', type: 'Casa', price: '$3,280,000', details: '3 recámaras · 2.5 baños · 220 m²', image: heroCasa },
  { title: 'Privada Sierra Norte', location: 'San Luis Potosí, S.L.P.', type: 'Desarrollo', price: 'Desde $2,450,000', details: 'Residencias · Acceso controlado', image: residencial },
  { title: 'Terreno campestre', location: 'Altiplano Potosino', type: 'Terreno', price: '$495,000', details: '1,000 m² · Acceso por camino', image: terreno },
]

const ArrowIcon = () => <span aria-hidden="true">↗</span>

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchMessage, setSearchMessage] = useState('')

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const type = data.get('type') || 'propiedades'
    const location = data.get('location') || 'la zona seleccionada'
    setSearchMessage(`Mostrando ${String(type).toLowerCase()} en ${location}.`)
    document.querySelector('#propiedades')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="Casa Mexino, inicio">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span>Casa Mexino</span>
        </a>
        <button className="menu-button" type="button" aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen((open) => !open)}>
          <span /><span /><span />
          <span className="sr-only">Abrir menú</span>
        </button>
        <nav id="main-navigation" className={menuOpen ? 'nav nav-open' : 'nav'}>
          <a href="#propiedades" onClick={() => setMenuOpen(false)}>Propiedades</a>
          <a href="#servicios" onClick={() => setMenuOpen(false)}>Vender</a>
          <a href="#nosotros" onClick={() => setMenuOpen(false)}>Nosotros</a>
          <a className="nav-contact" href="#contacto" onClick={() => setMenuOpen(false)}>Contacto</a>
        </nav>
      </header>

      <main>
        <section className="hero-section" id="inicio">
          <img className="hero-image" src={heroCasa} alt="Casa contemporánea iluminada al atardecer" />
          <div className="hero-overlay" />
          <div className="hero-content">
            <p className="eyebrow">Inmobiliaria en San Luis Potosí</p>
            <h1>El lugar correcto<br />para tu siguiente historia.</h1>
            <p className="hero-copy">Encuentra casas, terrenos y oportunidades seleccionadas con acompañamiento claro en cada decisión.</p>
            <form className="property-search" onSubmit={handleSearch}>
              <label><span>Estoy buscando</span><select name="type" defaultValue="Casa"><option>Casa</option><option>Terreno</option><option>Local</option><option>Propiedades</option></select></label>
              <label><span>Ubicación</span><select name="location" defaultValue="Matehuala"><option>Matehuala</option><option>San Luis Potosí</option><option>Altiplano Potosino</option></select></label>
              <label><span>Presupuesto</span><select name="budget" defaultValue="Cualquier precio"><option>Cualquier precio</option><option>Hasta $750 mil</option><option>Hasta $2 millones</option><option>Más de $2 millones</option></select></label>
              <button type="submit">Buscar</button>
            </form>
          </div>
          <a className="hero-scroll" href="#propiedades">Explorar propiedades <span aria-hidden="true">↓</span></a>
        </section>

        <section className="properties-section" id="propiedades">
          <div className="section-heading">
            <div><p className="eyebrow dark">Selección Mexino</p><h2>Propiedades destacadas</h2></div>
            <a href="#propiedades">Ver todas <ArrowIcon /></a>
          </div>
          {searchMessage && <p className="search-message" role="status">{searchMessage}</p>}
          <div className="property-grid">
            {properties.map((property) => (
              <article className="property-card" key={property.title}>
                <a href="#contacto" aria-label={`Consultar ${property.title}`}>
                  <div className="property-media"><img src={property.image} alt={property.title} /><span className="property-tag">{property.type}</span></div>
                  <div className="property-info">
                    <p>{property.location}</p><h3>{property.title}</h3><span className="property-details">{property.details}</span>
                    <div className="property-price"><strong>{property.price}</strong><span className="round-arrow"><ArrowIcon /></span></div>
                  </div>
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="services-section" id="servicios">
          <div className="services-intro"><p className="eyebrow dark">Más que propiedades</p><h2>Decisiones inmobiliarias con dirección y confianza.</h2></div>
          <div className="service-list">
            <div><span>01</span><h3>Compra y venta</h3><p>Te acompañamos desde la búsqueda hasta el cierre de la operación.</p></div>
            <div><span>02</span><h3>Terrenos y desarrollos</h3><p>Opciones con potencial para construir, invertir o hacer crecer tu patrimonio.</p></div>
            <div><span>03</span><h3>Asesoría cercana</h3><p>Información clara y seguimiento personal durante todo el proceso.</p></div>
          </div>
        </section>

        <section className="about-section" id="nosotros">
          <p className="eyebrow">Casa Mexino</p><h2>Conocemos el valor de encontrar un lugar que se sienta propio.</h2><a href="#contacto">Conócenos <ArrowIcon /></a>
        </section>
      </main>

      <footer id="contacto">
        <div><p className="eyebrow">Hablemos de tu próximo paso</p><h2>Tu propiedad puede comenzar aquí.</h2></div>
        <a className="footer-cta" href="mailto:contacto@casamexino.com">Contactar a Casa Mexino <ArrowIcon /></a>
        <div className="footer-bottom"><span>© 2026 Casa Mexino</span><div><a href="#privacidad">Privacidad</a><a href="#terminos">Términos</a></div></div>
      </footer>
    </div>
  )
}

export default App
