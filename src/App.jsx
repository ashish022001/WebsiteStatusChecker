import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import WebsiteStatusChecker from "./Components/WebsiteStatusChecker";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<WebsiteStatusChecker />} />
      </Routes>
    </Router>
  );
}

export default App;
