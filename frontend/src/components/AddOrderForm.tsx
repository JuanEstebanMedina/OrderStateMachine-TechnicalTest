import React, { useState } from 'react';

const AddOrderForm = ({ addOrder }) => {
  const [orderName, setOrderName] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    if (orderName) {
      addOrder(orderName);
      setOrderName('');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={orderName}
        onChange={(e) => setOrderName(e.target.value)}
        placeholder="Enter order name"
      />
      <button type="submit">Add Order</button>
    </form>
  );
};

export default AddOrderForm;
