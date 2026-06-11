import React, { useEffect, useState } from 'react';
import api from "../api.js";
import AddOrderForm from './AddOrderForm';

const OrderList = () => {
  const [orders, setOrders] = useState([]);

  const fetchOrders = async () => {
    try {
      const response = await api.get('/orders');
      setOrders(response.data.orders);
    } catch (error) {
      console.error("Error fetching orders", error);
    }
  };

  const addOrder = async (orderName) => {
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
          <li key={index}>{order.name}</li>
        ))}
      </ul>
      <AddOrderForm addOrder={addOrder} />
    </div>
  );
};

export default OrderList;
