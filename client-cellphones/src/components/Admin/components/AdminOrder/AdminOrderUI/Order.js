import React from "react";
import { useDispatch } from "react-redux";
import {
  createOrderGhn,
  PrintOrderGhn,
} from "../../../../../actions/GhnAction";
import {
  deleteOrder,
  getAllOrder,
  ShippingOrder,
} from "../../../../../actions/OrderAction";
import {
  formatPrice,
  formatDateOrderPaypal,
} from "../../../../../untils/index";

function Order(props) {
  const { order } = props;
  const dispatch = useDispatch();

  const {
    orderItems,
    totalPrice,
    paymentMethod,
    shippingAddress,
    status,
    paymentResult,
  } = order;

  const handleShippingOrder = async (order) => {
    console.log("handleShippingOrder");
    await dispatch(createOrderGhn(order._id)); // Tạo đơn hàng trên GHN
    await dispatch(ShippingOrder(order._id)); // Cập nhật trạng thái đơn hàng

    dispatch(getAllOrder()); // Lấy danh sách đơn hàng
  };

  const handlePrintOrder = (order) => {
    dispatch(PrintOrderGhn(order._id)); // In đơn hàng GHN
  };

  const handleDeleteOrder = async (order) => {
    await dispatch(deleteOrder(order._id)); // Xóa đơn hàng
    dispatch(getAllOrder()); // Lấy danh sách đơn hàng sau khi xóa
  };

  return (
    <>
      <div className="order-list">
        <div className="order-list-items">
          {orderItems.map((item, index) => (
            <div className="order-items-item" key={index}>
              <span className="img">
                <img src={item.image} alt={item.name} />
              </span>
              <span className="qty">Qty: {item.qty}</span>
              <span className="name">{item.name}</span>
              <span className="price">{formatPrice(item.salePrice)}</span>
            </div>
          ))}
        </div>

        <div className="totalPrice">
          <span>Tổng tiền: {formatPrice(totalPrice)}</span>
        </div>

        <div className="order-info">
          <div className="order-info-address">
            <b>Địa chỉ : </b>
            {shippingAddress.name}, {shippingAddress.province},{" "}
            {shippingAddress.district}, {shippingAddress.ward},{" "}
            {shippingAddress.detail}, {shippingAddress.phone}
          </div>
        </div>

        {paymentResult ? (
          <div className="order-payment-check">
            Paid: {formatDateOrderPaypal(paymentResult.update_time)}
          </div>
        ) : (
          ""
        )}

        <div className="order-bottom">
          {status === "shipping" ? (
            <div className="order-status">
              <span>
                Đã xác nhận{" "}
                {paymentMethod === "payOnline" ? (
                  <span>& Đã thanh toán</span>
                ) : (
                  ""
                )}
              </span>
            </div>
          ) : (
            ""
          )}

          <div className="order-button">
            {status === "pendding" ? (
              <button
                className="shipping"
                onClick={() => handleShippingOrder(order)}
              >
                Xác nhận đơn hàng
              </button>
            ) : (
              ""
            )}

            <button
              className="cancel-order"
              onClick={() => handleDeleteOrder(order)}
            >
              Hủy đơn
            </button>

            {status === "shipping" ? (
              <button
                className="print-order"
                onClick={() => handlePrintOrder(order)}
              >
                In đơn hàng
              </button>
            ) : (
              ""
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default Order;
