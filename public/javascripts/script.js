function addToCart(productId){
        $.ajax({
            url: '/add-to-cart/' + productId,
            method: 'GET',
            success:(response)=>{
                if (response.status) {
                    $("#cart-count").html(response.cartCount)
                }
            }
        })
    }