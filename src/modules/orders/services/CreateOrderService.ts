import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer doesnt exist.');
    }

    const existingProducts = await this.productsRepository.findAllById(
      products,
    );

    if (products.length > existingProducts.length) {
      throw new AppError('Invalid product cannot be added to your order.');
    }

    existingProducts.forEach(product => {
      const orderProduct = products.find(prod => prod.id === product.id);

      if (orderProduct && orderProduct.quantity > product.quantity) {
        throw new AppError('Not enough stock to fulfill your order');
      }
    });

    const orderProducts = products.map(product => {
      const existingProduct = existingProducts.find(
        prod => prod.id === product.id,
      );

      const productPrice = (existingProduct && existingProduct.price) || 1;

      return {
        product_id: product.id,
        price: productPrice,
        quantity: product.quantity,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: orderProducts,
    });

    await this.productsRepository.updateQuantity(products);

    return order;
  }
}

export default CreateOrderService;
