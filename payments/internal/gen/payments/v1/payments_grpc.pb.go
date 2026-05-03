package paymentsv1

import (
	context "context"

	grpc "google.golang.org/grpc"
	codes "google.golang.org/grpc/codes"
	status "google.golang.org/grpc/status"
)

const _ = grpc.SupportPackageIsVersion9

const (
	PaymentsService_CreateTransaction_FullMethodName    = "/payments.v1.PaymentsService/CreateTransaction"
	PaymentsService_GetTransactionByCode_FullMethodName = "/payments.v1.PaymentsService/GetTransactionByCode"
)

type PaymentsServiceClient interface {
	CreateTransaction(ctx context.Context, in *CreateTransactionRequest, opts ...grpc.CallOption) (*CreateTransactionResponse, error)
	GetTransactionByCode(ctx context.Context, in *GetTransactionByCodeRequest, opts ...grpc.CallOption) (*GetTransactionByCodeResponse, error)
}

type paymentsServiceClient struct {
	cc grpc.ClientConnInterface
}

func NewPaymentsServiceClient(cc grpc.ClientConnInterface) PaymentsServiceClient {
	return &paymentsServiceClient{cc}
}

func (c *paymentsServiceClient) CreateTransaction(ctx context.Context, in *CreateTransactionRequest, opts ...grpc.CallOption) (*CreateTransactionResponse, error) {
	out := new(CreateTransactionResponse)
	err := c.cc.Invoke(ctx, PaymentsService_CreateTransaction_FullMethodName, in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *paymentsServiceClient) GetTransactionByCode(ctx context.Context, in *GetTransactionByCodeRequest, opts ...grpc.CallOption) (*GetTransactionByCodeResponse, error) {
	out := new(GetTransactionByCodeResponse)
	err := c.cc.Invoke(ctx, PaymentsService_GetTransactionByCode_FullMethodName, in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

type PaymentsServiceServer interface {
	CreateTransaction(context.Context, *CreateTransactionRequest) (*CreateTransactionResponse, error)
	GetTransactionByCode(context.Context, *GetTransactionByCodeRequest) (*GetTransactionByCodeResponse, error)
	mustEmbedUnimplementedPaymentsServiceServer()
}

type UnimplementedPaymentsServiceServer struct{}

func (UnimplementedPaymentsServiceServer) CreateTransaction(context.Context, *CreateTransactionRequest) (*CreateTransactionResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method CreateTransaction not implemented")
}

func (UnimplementedPaymentsServiceServer) GetTransactionByCode(context.Context, *GetTransactionByCodeRequest) (*GetTransactionByCodeResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetTransactionByCode not implemented")
}

func (UnimplementedPaymentsServiceServer) mustEmbedUnimplementedPaymentsServiceServer() {}

func RegisterPaymentsServiceServer(s grpc.ServiceRegistrar, srv PaymentsServiceServer) {
	s.RegisterService(&PaymentsService_ServiceDesc, srv)
}

func _PaymentsService_CreateTransaction_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(CreateTransactionRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(PaymentsServiceServer).CreateTransaction(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: PaymentsService_CreateTransaction_FullMethodName,
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(PaymentsServiceServer).CreateTransaction(ctx, req.(*CreateTransactionRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _PaymentsService_GetTransactionByCode_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(GetTransactionByCodeRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(PaymentsServiceServer).GetTransactionByCode(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: PaymentsService_GetTransactionByCode_FullMethodName,
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(PaymentsServiceServer).GetTransactionByCode(ctx, req.(*GetTransactionByCodeRequest))
	}
	return interceptor(ctx, in, info, handler)
}

var PaymentsService_ServiceDesc = grpc.ServiceDesc{
	ServiceName: "payments.v1.PaymentsService",
	HandlerType: (*PaymentsServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{
			MethodName: "CreateTransaction",
			Handler:    _PaymentsService_CreateTransaction_Handler,
		},
		{
			MethodName: "GetTransactionByCode",
			Handler:    _PaymentsService_GetTransactionByCode_Handler,
		},
	},
	Streams:  []grpc.StreamDesc{},
	Metadata: "payments/v1/payments.proto",
}
