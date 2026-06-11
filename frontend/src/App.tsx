import './App.css';
import OrderList from './components/Orders';

const App = () => {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Order Management App</h1>
      </header>
      <main>
        <OrderList />
      </main>
    </div>
  );
};

export default App;
