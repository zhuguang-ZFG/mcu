#include "service.h"
#include <string.h>
void device_service_init(device_service_t *s, uint8_t platform, uint32_t reset, bool health, fault_fn fault, void *user)
{
    memset(s,0,sizeof(*s)); protocol_rx_init(&s->rx,100); protocol_tx_init(&s->tx);
    s->platform=platform; s->reset_reason=reset; s->health=health; s->fault=fault; s->fault_user=user;
}
void device_service_feed(device_service_t *s, uint8_t byte, uint32_t now)
{
    frame_t request;
    if (!protocol_rx_feed(&s->rx,byte,now,&request) || (request.type&0x80U)) return;
    frame_t response={0};
    response.type=request.type|0x80U; response.sequence=request.sequence; response.length=1;
    bool invoke=false;
    switch (request.type) {
    case 1:
        if (request.length) { response.payload[0]=2; break; }
        response.length=5; response.payload[1]=1; response.payload[2]=s->platform;
        write_le16(response.payload+3,(uint16_t)(1U|(s->health?2U:0U)|(s->fault?4U:0U)));
        break;
    case 2:
        if (request.length) { response.payload[0]=2; break; }
        response.length=25; response.payload[1]=1;
        write_le32(response.payload+2,now); write_le32(response.payload+6,s->reset_reason);
        response.payload[10]=s->required; response.payload[11]=s->overdue; response.payload[12]=s->flags;
        write_le32(response.payload+13,s->rx.stats.ok); write_le32(response.payload+17,protocol_errors(&s->rx.stats));
        write_le32(response.payload+21,s->tx.dropped);
        break;
    case 0x7f:
        if (!s->fault) { response.payload[0]=1; break; }
        if (request.length!=2 || !((request.payload[0]==1 && request.payload[1]<2) ||
            (request.payload[0]==2 && request.payload[1]==0))) { response.payload[0]=2; break; }
        invoke=true; break;
    default: response.payload[0]=1; break;
    }
    /* No accepted command side effect if its acknowledgement cannot be queued. */
    if (protocol_tx_enqueue(&s->tx,&response) && invoke)
        s->fault(s->fault_user,request.payload[0],request.payload[1]);
}
