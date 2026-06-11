import { useEffect, useState } from 'react';
import api from '../api';
import AddOrderForm from './AddOrderForm';

type Order = {
  id?: string | number;
  name: string;
};

const OrderList = () => {
  const [orders, setOrders] = useState<Order[]>([]);

  const fetchOrders = async () => {
    try {
      const response = await api.get('/orders');
      setOrders(response.data.orders);
    } catch (error) {
      console.error("Error fetching orders", error);
    }
  };

  const addOrder = async (orderName: string) => {
    try {
      await api.post('/orders', { name: orderName });
      fetchOrders();  // Refresh the list after adding an order
    } catch (error) {
      console.error("Error adding order", error);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <div>
      <h2>Orders List</h2>
      <ul>
        {orders.map((order, index) => (
          <li key={order.id ?? index}>{order.name}</li>
        ))}
      </ul>
      <AddOrderForm addOrder={addOrder} />
    </div>
  );
};

export default OrderList;
