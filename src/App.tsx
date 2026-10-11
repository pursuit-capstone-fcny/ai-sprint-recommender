import { Route, Routes } from 'react-router';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  );
}

function Home() {
  return (
    <main>
      <h1>FCNY Sprint Recommender</h1>
      <p>Catalog and ranking land in later issues.</p>
    </main>
  );
}
