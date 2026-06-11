import { type SubmitEvent, useState } from 'react';

type AddOrderFormProps = {
  addOrder: (orderName: string) => void | Promise<void>;
};

const AddOrderForm = ({ addOrder }: AddOrderFormProps) => {
  const [orderName, setOrderName] = useState('');

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedOrderName = orderName.trim();

    if (!trimmedOrderName) {
      return;
    }

    await addOrder(trimmedOrderName);
    setOrderName('');
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={orderName}
        onChange={(event) => setOrderName(event.target.value)}
        placeholder="Enter order name"
      />
      <button type="submit">Add Order</button>
    </form>
  );
};

export default AddOrderForm;
