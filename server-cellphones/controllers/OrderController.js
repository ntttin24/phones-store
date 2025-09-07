import { OrderModel } from "../models/OrderModel.js";
import expressAsyncHandler from "express-async-handler";
import axios from "axios";
import dotenv from "dotenv";
import fetch from "node-fetch";
dotenv.config();

// Hàm quy đổi từ VND sang USD
const convertVNDtoUSD = async (amountVND) => {
  const response = await axios.get(
    "https://api.exchangerate-api.com/v4/latest/VND"
  );
  const exchangeRate = response.data.rates.USD; // Lấy tỷ giá USD
  const amountUSD = (amountVND / exchangeRate).toFixed(2); // Quy đổi VND sang USD
  return amountUSD;
};

// API tạo thanh toán PayPal
export const createPayPalPayment = async (req, res) => {
  try {
    const amountVND = req.body.totalPrice; // Giá trị VND từ frontend
    const amountUSD = await convertVNDtoUSD(amountVND); // Quy đổi sang USD

    const create_payment_json = {
      intent: "sale",
      payer: {
        payment_method: "paypal",
      },
      transactions: [
        {
          amount: {
            currency: "USD",
            total: amountUSD, // Thanh toán bằng USD
          },
          description: "Thanh toán đơn hàng từ hệ thống.",
        },
      ],
      redirect_urls: {
        return_url: "http://localhost:3000/paymentSuccess",
        cancel_url: "http://localhost:3000/paymentCancel",
      },
    };

    // Gửi yêu cầu đến PayPal API
    const payment = await paypal.payment.create(create_payment_json);
    res.status(200).json(payment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createOrder = expressAsyncHandler(async (req, res) => {
  if (req.body.orderItems.length === 0) {
    res.status(400).send({ message: "cart is emty" });
  } else {
    const order = new OrderModel({
      order_code: "",
      to_ward_code: req.body.to_ward_code,
      to_district_id: req.body.to_district_id,
      cancelOrder: false,

      orderItems: req.body.orderItems,
      shippingAddress: {
        province: req.body.shippingAddress.province,
        district: req.body.shippingAddress.district,
        ward: req.body.shippingAddress.ward,
        detail: req.body.shippingAddress.more,
        name: req.body.shippingAddress.name,
        phone: req.body.shippingAddress.phone,
      },
      paymentMethod: req.body.paymentMethod,
      paymentResult: req.body.paymentResult
        ? {
            id: req.body.paymentResult.id,
            status: req.body.paymentResult.status,
            update_time: req.body.paymentResult.update_time,
            email_address: req.body.paymentResult.payer.email_address,
          }
        : "",
      totalPrice: req.body.totalPrice,
      status: req.body.status ? req.body.status : "pendding",
      name: req.body.name,
      user: req.body.user,
    });

    const createOrder = await order.save();
    res.status(201).send({ message: "new order created", order: createOrder });
  }
});

export const clientCancelOrder = expressAsyncHandler(async (req, res) => {
  const updateOrder = await OrderModel.findById({ _id: req.params.id });

  if (updateOrder) {
    updateOrder.cancelOrder = true;
    await updateOrder.save();
  }
  res.send(updateOrder);
});

export const updateOrder = expressAsyncHandler(async (req, res) => {
  console.log("Bắt đầu cập nhật đơn hàng...");

  let order = await OrderModel.findById(req.params.id);

  if (!order) {
    return res.status(404).send({ message: "Không tìm thấy đơn hàng" });
  }

  let items = [];
  order.orderItems.forEach((item) => {
    items.push({
      name: item.name,
      code: item._id,
      quantity: parseInt(item.qty, 10), // Chuyển đổi `quantity` sang số nguyên
      price: item.price || 0, // Đảm bảo `price` không bị `undefined`
      length: item.length || 10,
      width: item.width || 10,
      height: item.height || 10,
      weight: item.weight || 500,
      category: {
        level1: "Hàng hóa",
      },
    });
  });

  // Tính toán insurance_value (khai báo tối đa 5 triệu)
  const insuranceValue = Math.min(order.totalPrice, 5000000); // 5 triệu

  const payload = {
    payment_type_id: 2,
    note: "Ghi chú đơn hàng",
    required_note: "KHONGCHOXEMHANG",
    from_name: "Your Shop Name",
    from_phone: "0784723481",
    from_address: "Sư Vạn Hạnh, Phường 14, Quận 10, Hồ Chí Minh",
    from_ward_name: "Phường 14",
    from_district_name: "Quận 10",
    from_province_name: "Hồ Chí Minh",
    to_name: order.shippingAddress.name,
    to_phone: order.shippingAddress.phone,
    to_address: order.shippingAddress.detail,
    to_ward_code: order.to_ward_code,
    to_district_id: order.to_district_id,
    cod_amount: order.totalPrice,
    content: "Chi tiết đơn hàng",
    weight: 200, // Tổng khối lượng
    length: 10,
    width: 10,
    height: 10,
    insurance_value: Math.min(order.totalPrice, 5000000), // Giới hạn 5 triệu
    service_id: 0,
    service_type_id: 2,
    items: items,
  };

  console.log("Payload gửi GHN:", JSON.stringify(payload, null, 2));

  try {
    const response = await axios.post(
      "https://dev-online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/create",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          ShopId: process.env.SHOP_ID,
          Token: process.env.TOKEN_GHN,
        },
      }
    );

    const responseData = response.data;
    console.log("Kết quả từ GHN:", responseData);

    if (responseData.data && responseData.data.order_code) {
      order.order_code = responseData.data.order_code;
      await order.save();
    }

    res.status(200).send({ message: "Đơn hàng đã cập nhật", order });
  } catch (error) {
    console.error(
      "Lỗi khi gửi yêu cầu đến GHN:",
      error.response?.data || error.message
    );
    res.status(400).send({
      message: "Không thể cập nhật đơn hàng",
      error: error.response?.data || error.message,
    });
  }
});

export const PrintOrderGhn = expressAsyncHandler(async (req, res) => {
  const Order = await OrderModel.findById({ _id: req.params.id });
  if (Order) {
    let token;
    try {
      const { data } = await axios.get(
        "https://dev-online-gateway.ghn.vn/shiip/public-api/v2/a5/gen-token",
        {
          headers: {
            Token: process.env.TOKEN_GHN,
          },
          params: {
            order_codes: Order.order_code,
          },
        }
      );

      token = data.data.token;
      Order.token = token;
      await Order.save();

      const result = await axios.get(
        `https://dev-online-gateway.ghn.vn/a5/public-api/printA5?token=${token}`,
        {
          headers: {
            Token: process.env.TOKEN_GHN,
          },
        }
      );
      res.send(result.config.url);
    } catch (error) {}
  } else {
    res.send({ message: "order not found" });
  }
});

export const GetAllOrder = expressAsyncHandler(async (req, res) => {
  //await OrderModel.remove()
  const Order = await OrderModel.find({}).sort({ createdAt: -1 });
  if (Order) {
    res.send(Order);
  } else {
    res.status(401).send({ message: "no order" });
  }
});

export const GetAllOrderPaypal = expressAsyncHandler(async (req, res) => {
  const Order = await OrderModel.find({ paymentMethod: "payOnline" }).sort({
    createdAt: -1,
  });
  if (Order) {
    res.send(Order);
  } else {
    res.status(401).send({ message: "no order" });
  }
});

export const GetAllOrderPendding = expressAsyncHandler(async (req, res) => {
  const Order = await OrderModel.find({
    $or: [{ status: "pendding" }, { paymentMethod: "payOnline" }],
  }).sort({
    createdAt: -1,
  });
  if (Order) {
    res.send(Order);
  } else {
    res.status(401).send({ message: "no order" });
  }
});

export const GetAllOrderShipping = expressAsyncHandler(async (req, res) => {
  const Order = await OrderModel.find({ status: "shipping" }).sort({
    createdAt: -1,
  });
  if (Order) {
    res.send(Order);
  } else {
    res.status(401).send({ message: "no order" });
  }
});

export const GetAllOrderPaid = expressAsyncHandler(async (req, res) => {
  const Order = await OrderModel.find({ status: "paid" }).sort({
    createdAt: -1,
  });
  if (Order) {
    res.send(Order);
  } else {
    res.status(401).send({ message: "no order" });
  }
});

export const DeleteOrder = expressAsyncHandler(async (req, res) => {
  const deleteOrder = await OrderModel.findById({ _id: req.params.id });

  if (deleteOrder) {
    await deleteOrder.remove();
    res.send({ message: "product deleted" });
  } else {
    res.send("error in delete order");
  }
});

export const ShippingProduct = expressAsyncHandler(async (req, res) => {
  const status = "shipping";
  const Order = await OrderModel.findById({ _id: req.params.id });
  if (Order) {
    Order.status = status;
    await Order.save();
    res.send(Order);
  } else {
    res.status(401).send({ message: "no order" });
  }
});

export const PaidProduct = expressAsyncHandler(async (req, res) => {
  const status = "paid";
  const Order = await OrderModel.findByIdAndUpdate(
    { _id: req.params.id },
    { status: status }
  );
  if (Order) {
    res.send(Order);
  } else {
    res.status(401).send({ message: "no order" });
  }
});

// --------------------    user

export const GetOrderByUser = expressAsyncHandler(async (req, res) => {
  const Order = await OrderModel.find({ user: req.params.id }).sort({
    createdAt: -1,
  });
  if (Order) {
    res.send(Order);
  } else {
    res.status(401).send({ message: "no order by user" });
  }
});

export const GetOrderPaypalByUser = expressAsyncHandler(async (req, res) => {
  const Order = await OrderModel.find({
    user: req.params.id,
    paymentMethod: "payOnline",
  }).sort({ createdAt: -1 });
  if (Order) {
    res.send(Order);
  } else {
    res.status(401).send({ message: "no order by user" });
  }
});

export const GetOrderPenddingByUser = expressAsyncHandler(async (req, res) => {
  const Order = await OrderModel.find({
    user: req.params.id,
    status: "pendding",
  }).sort({ createdAt: -1 });
  if (Order) {
    res.send(Order);
  } else {
    res.status(401).send({ message: "no order by user" });
  }
});

export const GetOrderShippingByUser = expressAsyncHandler(async (req, res) => {
  const Order = await OrderModel.find({
    user: req.params.id,
    status: "shipping",
  }).sort({ createdAt: -1 });
  if (Order) {
    res.send(Order);
  } else {
    res.status(401).send({ message: "no order by user" });
  }
});

export const GetOrderPaidByUser = expressAsyncHandler(async (req, res) => {
  const Order = await OrderModel.find({
    user: req.params.id,
    status: "paid",
  }).sort({ createdAt: -1 });
  if (Order) {
    res.send(Order);
  } else {
    res.status(401).send({ message: "no order by user" });
  }
});

export const GetAllOrderInAMonth = expressAsyncHandler(async (req, res) => {
  const Order = await OrderModel.find({
    createdAt: {
      $gte: new Date(2021, 7, 11),
      $lt: new Date(2021, 7, 16),
    },
  });

  if (Order) {
    res.send(Order);
  } else {
    res.status(400).send({ message: "no product in a month" });
  }
});
